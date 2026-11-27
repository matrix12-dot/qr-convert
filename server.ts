import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {handleUploadOptions, handleUploadPost} from './shared/imgbbProxy';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// ضع مفتاح ImgBB API الخاص بك هنا أو داخل متغير البيئة IMGBB_API_KEY
// احصل على مفتاح مجاني من: https://api.imgbb.com/
// ============================================================================
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || 'YOUR_IMGBB_API_KEY_HERE';

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, {recursive: true});

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_STORED_FILES = 100;
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.msi',
  '.scr',
  '.vbs',
  '.ps1',
  '.com',
  '.pif',
]);

function isImgbbConfigured(): boolean {
  return (
    Boolean(IMGBB_API_KEY) &&
    IMGBB_API_KEY !== 'YOUR_IMGBB_API_KEY_HERE' &&
    IMGBB_API_KEY !== 'MY_IMGBB_API_KEY'
  );
}

function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName || 'attachment').replace(/[\x00-\x1f\x7f"\\/:*?<>|]/g, '_').trim();
  if (!base) return 'attachment';
  return base.slice(0, 120);
}

function resolveSafeUploadPath(fileName: string): string | null {
  const resolved = path.resolve(UPLOADS_DIR, fileName);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function getPublicBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Fallback to request headers
    }
  }

  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto === 'https' || req.secure ? 'https' : 'http';
  const rawHost =
    req.header('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.header('host')?.trim() ||
    'localhost:3000';
  const safeHost = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : 'localhost:3000';
  return `${proto}://${safeHost}`;
}

function pruneOldUploads(): void {
  try {
    const entries = fs
      .readdirSync(UPLOADS_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const fullPath = resolveSafeUploadPath(name);
        if (!fullPath) return null;
        const stat = fs.statSync(fullPath);
        return {name, mtimeMs: stat.mtimeMs};
      })
      .filter((item): item is {name: string; mtimeMs: number} => item !== null)
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    if (entries.length <= MAX_STORED_FILES) return;

    const excess = entries.length - MAX_STORED_FILES;
    for (let i = 0; i < excess; i++) {
      const id = entries[i].name.replace(/\.json$/, '');
      const metaPath = resolveSafeUploadPath(`${id}.json`);
      const binPath = resolveSafeUploadPath(`${id}.bin`);
      if (metaPath && fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      if (binPath && fs.existsSync(binPath)) fs.unlinkSync(binPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

interface ImgbbUploadRequestBody {
  imageBase64?: string;
  name?: string;
}

interface FileUploadRequestBody {
  fileBase64?: string;
  fileName?: string;
  mimeType?: string;
}

interface StoredFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

interface ImgbbApiResponse {
  success: boolean;
  status: number;
  data?: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    size: number;
    delete_url: string;
    thumb?: {
      url: string;
    };
  };
  error?: {
    message: string;
    code: number;
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({limit: '45mb'}));

  // فحص حالة إعداد مفتاح ImgBB دون كشف المفتاح للواجهة
  app.get('/api/upload-status', (_req, res) => {
    res.json({
      configured: isImgbbConfigured(),
    });
  });

  app.options(['/api/upload', '/api/upload-image'], (_req, res) => {
    const webRes = handleUploadOptions();
    webRes.headers.forEach((val, key) => res.setHeader(key, val));
    res.status(webRes.status).end();
  });

  // نقطة نهاية وسيطة موحدة لرفع الصور (تدعم FormData و JSON) مع ترويسات CORS
  app.post(
    ['/api/upload', '/api/upload-image'],
    express.raw({type: 'multipart/form-data', limit: '35mb'}),
    async (req, res) => {
      try {
        const contentType = req.header('content-type') || '';
        const bodyPayload = Buffer.isBuffer(req.body)
          ? new Uint8Array(req.body)
          : typeof req.body === 'object' && req.body !== null
            ? JSON.stringify(req.body)
            : '';

        const webReq = new Request('http://localhost/api/upload', {
          method: 'POST',
          headers: {'content-type': contentType},
          body: bodyPayload,
        });

        const webRes = await handleUploadPost(webReq, IMGBB_API_KEY);
        webRes.headers.forEach((val, key) => res.setHeader(key, val));
        const text = await webRes.text();
        res.status(webRes.status).send(text);
      } catch (error) {
        console.error('Upload proxy error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.status(500).json({
          error: 'SERVER_ERROR',
          message: 'حدث خطأ غير متوقع أثناء معالجة الصورة على الخادم.',
        });
      }
    }
  );

  // رفع وإرفاق الملفات العامة وتوليد رابط تحميل مباشر لرمز QR
  app.post('/api/upload-file', (req, res) => {
    try {
      const body = req.body as FileUploadRequestBody;
      const rawData = body?.fileBase64?.trim();

      if (!rawData) {
        res.status(400).json({
          error: 'INVALID_FILE',
          message: 'يرجى اختيار ملف صالح للإرفاق.',
        });
        return;
      }

      const safeFileName = sanitizeFileName(body.fileName || 'attachment');
      const ext = path.extname(safeFileName).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        res.status(400).json({
          error: 'UNSUPPORTED_FILE_TYPE',
          message: 'صيغة الملف غير مسموح بها لأسباب أمنية.',
        });
        return;
      }

      const cleanBase64 = rawData.includes(',') ? rawData.split(',')[1] : rawData;
      if (!cleanBase64) {
        res.status(400).json({
          error: 'INVALID_FILE',
          message: 'بيانات الملف غير صالحة.',
        });
        return;
      }

      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      if (fileBuffer.length === 0) {
        res.status(400).json({
          error: 'EMPTY_FILE',
          message: 'الملف المرفق فارغ.',
        });
        return;
      }

      if (fileBuffer.length > MAX_FILE_BYTES) {
        res.status(413).json({
          error: 'FILE_TOO_LARGE',
          message: 'حجم الملف يتجاوز الحد المسموح به (15 ميجابايت).',
        });
        return;
      }

      const fileId = crypto.randomBytes(12).toString('hex');
      const binPath = resolveSafeUploadPath(`${fileId}.bin`);
      const metaPath = resolveSafeUploadPath(`${fileId}.json`);

      if (!binPath || !metaPath) {
        res.status(500).json({
          error: 'STORAGE_ERROR',
          message: 'تعذر حفظ الملف.',
        });
        return;
      }

      const meta: StoredFileMeta = {
        id: fileId,
        fileName: safeFileName,
        mimeType:
          typeof body.mimeType === 'string' && body.mimeType.trim()
            ? body.mimeType.trim().slice(0, 120)
            : 'application/octet-stream',
        size: fileBuffer.length,
        createdAt: Date.now(),
      };

      fs.writeFileSync(binPath, fileBuffer);
      fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');
      pruneOldUploads();

      const baseUrl = getPublicBaseUrl(req);
      const downloadUrl = `${baseUrl}/api/files/${fileId}`;

      res.json({
        id: fileId,
        url: downloadUrl,
        fileName: safeFileName,
        size: fileBuffer.length,
        mimeType: meta.mimeType,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'حدث خطأ أثناء رفع الملف المرفق.',
      });
    }
  });

  // تنزيل الملف المرفق عبر الرابط المضمن في رمز QR
  app.get('/api/files/:id', (req, res) => {
    try {
      const id = req.params.id;
      if (!/^[a-f0-9]{24}$/.test(id)) {
        res.status(404).send('الملف غير موجود.');
        return;
      }

      const binPath = resolveSafeUploadPath(`${id}.bin`);
      const metaPath = resolveSafeUploadPath(`${id}.json`);

      if (!binPath || !metaPath || !fs.existsSync(binPath) || !fs.existsSync(metaPath)) {
        res.status(404).send('الملف غير موجود أو انتهت صلاحيته.');
        return;
      }

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as StoredFileMeta;
      const encodedName = encodeURIComponent(meta.fileName);

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attachment"; filename*=UTF-8''${encodedName}`
      );
      res.setHeader('Content-Length', String(meta.size));
      res.sendFile(binPath);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).send('تعذر تحميل الملف.');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`QR Studio server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
