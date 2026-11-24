import React, {useRef, useState} from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import {formatBytesArabic} from '../utils/qrHelpers';

export interface UploadedImageInfo {
  url: string;
  thumbUrl: string;
  fileName: string;
  sizeBytes: number;
}

interface ImageUploaderProps {
  uploadedImage: UploadedImageInfo | null;
  apiConfigured: boolean | null;
  onImageUploaded: (info: UploadedImageInfo) => void;
  onClearImage: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function ImageUploader({
  uploadedImage,
  apiConfigured,
  onImageUploaded,
  onClearImage,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

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
      reader.onerror = () => reject(new Error('فشلت قراءة الصورة من الجهاز.'));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setPreviewFailed(false);

    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (PNG أو JPG أو WEBP أو GIF).');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('حجم الصورة يتجاوز الحد المسموح به (10 ميجابايت).');
      return;
    }

    setIsUploading(true);
    try {
      const base64DataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          name: file.name.replace(/\.[^.]+$/, ''),
        }),
      });

      const payload = (await response.json()) as {
        url?: string;
        thumbUrl?: string;
        message?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(
          payload.message || 'تعذر رفع الصورة عبر ImgBB. تحقق من الإعدادات وحاول مجدداً.'
        );
      }

      onImageUploaded({
        url: payload.url,
        thumbUrl: payload.thumbUrl || payload.url,
        fileName: file.name,
        sizeBytes: file.size,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الصورة.';
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
    if (!uploadedImage?.url) return;
    try {
      await navigator.clipboard.writeText(uploadedImage.url);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setErrorMsg('تعذر نسخ الرابط تلقائياً.');
    }
  };

  return (
    <div className="space-y-4">
      {apiConfigured === false && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-sm text-amber-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-medium text-amber-200">مطلوب إعداد مفتاح ImgBB API</p>
            <p className="text-xs text-amber-100/85">
              لتفعيل الرفع المباشر إلى ImgBB، أضف مفتاحك المجاني في متغير البيئة{' '}
              <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                IMGBB_API_KEY
              </code>{' '}
              داخل لوحة الأسرار أو ملف{' '}
              <code className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                server.ts
              </code>
              .
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="اختيار صورة للرفع إلى ImgBB"
      />

      {!uploadedImage ? (
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
                  جارٍ رفع الصورة إلى ImgBB...
                </p>
                <p className="text-xs text-slate-300">
                  سيتم إنشاء رمز QR فور استلام الرابط المباشر
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sky-300">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  اسحب الصورة وأفلتها هنا أو اختر من جهازك
                </p>
                <p className="text-xs text-slate-300">
                  PNG · JPG · WEBP · GIF · حتى 10 ميجابايت
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
              >
                <ImageIcon className="h-4 w-4" />
                <span>اختيار صورة</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-slate-950/40 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-slate-900">
              {!previewFailed ? (
                <img
                  src={uploadedImage.thumbUrl}
                  alt={uploadedImage.fileName}
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                <span className="truncate font-medium text-white">
                  {uploadedImage.fileName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {formatBytesArabic(uploadedImage.sizeBytes)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-emerald-300">مرفوعة على ImgBB</span>
              </div>

              <p
                dir="ltr"
                className="truncate rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs text-slate-200"
                title={uploadedImage.url}
              >
                {uploadedImage.url}
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
                  <span>نسخ رابط الصورة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.15] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>تغيير الصورة</span>
            </button>

            <button
              type="button"
              onClick={onClearImage}
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
