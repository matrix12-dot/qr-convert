import React, {useRef, useState} from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  Paperclip,
  RefreshCw,
} from 'lucide-react';
import {formatBytesArabic} from '../utils/qrHelpers';

export interface UploadedFileInfo {
  id: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

interface FileUploaderProps {
  uploadedFile: UploadedFileInfo | null;
  onFileUploaded: (info: UploadedFileInfo) => void;
  onClearFile: () => void;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function getFileTypeIcon(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(lower)) {
    return FileAudio;
  }
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|avi)$/.test(lower)) {
    return FileVideo;
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) {
    return FileArchive;
  }
  if (/\.(xls|xlsx|csv)$/.test(lower)) {
    return FileSpreadsheet;
  }
  return FileText;
}

export function FileUploader({
  uploadedFile,
  onFileUploaded,
  onClearFile,
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handleFile = async (file: File) => {
    setErrorMsg(null);

    if (file.size === 0) {
      setErrorMsg('الملف المحدد فارغ.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('حجم الملف يتجاوز الحد المسموح به (15 ميجابايت).');
      return;
    }

    setIsUploading(true);
    try {
      const base64DataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fileBase64: base64DataUrl,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      const payload = (await response.json()) as {
        id?: string;
        url?: string;
        fileName?: string;
        size?: number;
        mimeType?: string;
        message?: string;
      };

      if (!response.ok || !payload.url || !payload.id) {
        throw new Error(
          payload.message || 'تعذر إرفاق الملف حالياً. يرجى المحاولة مرة أخرى.'
        );
      }

      onFileUploaded({
        id: payload.id,
        url: payload.url,
        fileName: payload.fileName || file.name,
        sizeBytes: payload.size || file.size,
        mimeType: payload.mimeType || file.type || 'application/octet-stream',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الملف.';
      setErrorMsg(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleCopyUrl = async () => {
    if (!uploadedFile?.url) return;
    try {
      await navigator.clipboard.writeText(uploadedFile.url);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setErrorMsg('تعذر نسخ الرابط تلقائياً.');
    }
  };

  const ActiveIcon = uploadedFile
    ? getFileTypeIcon(uploadedFile.fileName, uploadedFile.mimeType)
    : FileText;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rar,.7z,.mp3,.wav,.mp4,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="اختيار ملف لإرفاقه وتوليد رمز QR"
      />

      {!uploadedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
            isDragging
              ? 'border-sky-400 bg-sky-400/10'
              : 'border-white/20 bg-slate-950/35 hover:border-white/35 hover:bg-slate-950/50'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  جارٍ إرفاق الملف وتجهيز رابط التحميل...
                </p>
                <p className="text-xs text-slate-300">
                  سيتم توليد رمز QR للوصول المباشر للملف فور الانتهاء
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sky-300">
                <Paperclip className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  اسحب أي ملف وأفلته هنا أو اختر من جهازك
                </p>
                <p className="text-xs text-slate-300">
                  PDF · Word · Excel · PowerPoint · ZIP · TXT · وسائط · حتى 15 ميجابايت
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
              >
                <Paperclip className="h-4 w-4" />
                <span>إرفاق ملف</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-slate-950/40 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sky-300">
              <ActiveIcon className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                <span className="truncate font-medium text-white">
                  {uploadedFile.fileName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {formatBytesArabic(uploadedFile.sizeBytes)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-emerald-300">جاهز للمسح والتحميل</span>
              </div>

              <p
                dir="ltr"
                className="truncate rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs text-slate-200"
                title={uploadedFile.url}
              >
                {uploadedFile.url}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              {copiedUrl ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>تم نسخ الرابط</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ رابط الملف</span>
                </>
              )}
            </button>

            <a
              href={uploadedFile.url}
              download={uploadedFile.fileName}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>تجربة التحميل</span>
            </a>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.15] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>تغيير الملف</span>
            </button>

            <button
              type="button"
              onClick={onClearFile}
              className="inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white whitespace-nowrap shrink-0"
            >
              إزالة
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-400/30 bg-red-500/15 p-3 text-xs text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
