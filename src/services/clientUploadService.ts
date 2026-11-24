import {IMGBB_API_KEY, isImgbbConfigured} from '../config/uploadConfig';

export const BLOCKED_FILE_EXTENSIONS = new Set([
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

interface ImgbbResponse {
  success?: boolean;
  data?: {
    url?: string;
    display_url?: string;
    thumb?: {
      url?: string;
    };
  };
  error?: {
    message?: string;
  };
}

interface GofileUploadResponse {
  status?: string;
  data?: {
    downloadPage?: string;
    code?: string;
    id?: string;
    name?: string;
  };
}

interface TmpfilesResponse {
  status?: string;
  data?: {
    url?: string;
  };
  message?: string;
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

function isSafeHttpUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('تعذر قراءة الملف.'));
      }
    };
    reader.onerror = () => reject(new Error('فشلت قراءة الملف من الجهاز.'));
    reader.readAsDataURL(file);
  });
}

async function uploadToGofile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://upload.gofile.io/uploadfile', {
    method: 'POST',
    body: formData,
  });

  const payload = await safeParseJson<GofileUploadResponse>(response);
  const downloadPage = payload?.data?.downloadPage;

  if (!response.ok || payload?.status !== 'ok' || !isSafeHttpUrl(downloadPage)) {
    throw new Error('تعذر رفع الملف حالياً. يرجى المحاولة مرة أخرى.');
  }

  return downloadPage;
}

async function uploadToTmpfiles(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = await safeParseJson<TmpfilesResponse>(response);
  const uploadedUrl = payload?.data?.url;

  if (!response.ok || payload?.status !== 'success' || !isSafeHttpUrl(uploadedUrl)) {
    throw new Error('تعذر رفع الملف حالياً. يرجى المحاولة مرة أخرى.');
  }

  return uploadedUrl;
}

export interface ClientImageUploadResult {
  url: string;
  thumbUrl: string;
}

export async function uploadImageClientSide(
  file: File
): Promise<ClientImageUploadResult> {
  const localThumbUrl = URL.createObjectURL(file);

  if (isImgbbConfigured()) {
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', file);
    formData.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 80));

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const payload = await safeParseJson<ImgbbResponse>(response);
    const imgUrl = payload?.data?.url;

    if (!response.ok || !payload?.success || !isSafeHttpUrl(imgUrl)) {
      URL.revokeObjectURL(localThumbUrl);
      throw new Error(
        payload?.error?.message ||
          'تعذر رفع الصورة حالياً. يرجى المحاولة مرة أخرى.'
      );
    }

    const thumbUrl = isSafeHttpUrl(payload.data?.thumb?.url)
      ? payload.data.thumb.url
      : isSafeHttpUrl(payload.data?.display_url)
        ? payload.data.display_url
        : localThumbUrl;

    if (thumbUrl !== localThumbUrl) {
      URL.revokeObjectURL(localThumbUrl);
    }

    return {
      url: imgUrl,
      thumbUrl,
    };
  }

  try {
    const hostedUrl = await uploadToGofile(file);
    return {
      url: hostedUrl,
      thumbUrl: localThumbUrl,
    };
  } catch {
    try {
      const fallbackUrl = await uploadToTmpfiles(file);
      return {
        url: fallbackUrl,
        thumbUrl: localThumbUrl,
      };
    } catch (err) {
      URL.revokeObjectURL(localThumbUrl);
      throw err;
    }
  }
}

export interface ClientFileUploadResult {
  id: string;
  url: string;
  mode: 'hosted' | 'embedded';
}

export async function uploadFileClientSide(
  file: File
): Promise<ClientFileUploadResult> {
  const extMatch = file.name.toLowerCase().match(/\.[a-z0-9]+$/);
  if (extMatch && BLOCKED_FILE_EXTENSIONS.has(extMatch[0])) {
    throw new Error('صيغة الملف غير مسموح بها لأسباب أمنية.');
  }

  try {
    const uploadedUrl = await uploadToGofile(file);
    return {
      id: `${Date.now()}`,
      url: uploadedUrl,
      mode: 'hosted',
    };
  } catch (err) {
    if (file.size <= 50 * 1024 * 1024) {
      try {
        const fallbackUrl = await uploadToTmpfiles(file);
        return {
          id: `${Date.now()}`,
          url: fallbackUrl,
          mode: 'hosted',
        };
      } catch {
        // Continue to small-file embedded fallback
      }
    }

    if (file.size <= 1800) {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length <= 2600) {
        return {
          id: `${Date.now()}`,
          url: dataUrl,
          mode: 'embedded',
        };
      }
    }

    throw err instanceof Error
      ? err
      : new Error('تعذر رفع الملف حالياً. يرجى المحاولة مرة أخرى.');
  }
}
