import {useEffect, useRef, useState} from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import {calculateContrastRatio} from '../utils/qrHelpers';

export type ErrorCorrectionLevel = 'M' | 'Q' | 'H';

interface QrPreviewPanelProps {
  content: string;
  mode: 'text' | 'image' | 'file';
  fgColor: string;
  bgColor: string;
  exportSize: number;
  errorLevel: ErrorCorrectionLevel;
  onDownloadTriggered?: () => void;
}

export function QrPreviewPanel({
  content,
  mode,
  fgColor,
  bgColor,
  exportSize,
  errorLevel,
  onDownloadTriggered,
}: QrPreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const trimmedContent = content.trim();
  const hasContent = trimmedContent.length > 0;
  const contrastRatio = calculateContrastRatio(fgColor, bgColor);
  const lowContrast = contrastRatio < 3.0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasContent) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setRenderError(null);
      return;
    }

    let cancelled = false;
    QRCode.toCanvas(
      canvas,
      trimmedContent,
      {
        width: 320,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      },
      (err) => {
        if (cancelled) return;
        if (err) {
          setRenderError('النص طويل جداً أو يتعذر ترميزه في رمز QR.');
        } else {
          setRenderError(null);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [trimmedContent, hasContent, fgColor, bgColor, errorLevel]);

  const handleDownloadPng = async () => {
    if (!hasContent) return;
    try {
      const highResDataUrl = await QRCode.toDataURL(trimmedContent, {
        width: exportSize,
        margin: 3,
        errorCorrectionLevel: errorLevel,
        type: 'image/png',
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });

      const link = document.createElement('a');
      link.href = highResDataUrl;
      link.download = `qr-code-${exportSize}px-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onDownloadTriggered?.();
    } catch {
      setRenderError('تعذر توليد ملف PNG للتنزيل.');
    }
  };

  const handleCopyImage = async () => {
    if (!hasContent || !navigator.clipboard?.write) return;
    try {
      const highResDataUrl = await QRCode.toDataURL(trimmedContent, {
        width: exportSize,
        margin: 3,
        errorCorrectionLevel: errorLevel,
        type: 'image/png',
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });
      const response = await fetch(highResDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      setCopiedImage(true);
      window.setTimeout(() => setCopiedImage(false), 2000);
    } catch {
      await handleCopyText();
    }
  };

  const handleCopyText = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(trimmedContent);
      setCopiedContent(true);
      window.setTimeout(() => setCopiedContent(false), 2000);
    } catch {
      // Clipboard blocked silently
    }
  };

  const modeLabel =
    mode === 'image' ? 'رابط صورة' : mode === 'file' ? 'رابط ملف مرفق' : 'نص / رابط';

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <h2 className="text-base font-bold text-white">المعاينة الحية</h2>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span>{modeLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {exportSize}×{exportSize}px
          </span>
        </div>
      </div>

      <div className="qr-stage-glass mt-5 flex min-h-[300px] items-center justify-center rounded-xl border border-white/10 p-6">
        {hasContent && !renderError ? (
          <div
            className="rounded-xl p-3 shadow-[0_16px_40px_rgba(2,6,23,0.45)] ring-1 ring-white/20 transition-transform duration-150"
            style={{backgroundColor: bgColor}}
          >
            <canvas
              ref={canvasRef}
              className="block h-[220px] w-[220px] sm:h-[256px] sm:w-[256px]"
              aria-label="رمز QR المولّد"
            />
          </div>
        ) : (
          <div className="flex max-w-xs flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-300">
              <QrCode className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-slate-100">
              {renderError || 'بانتظار المحتوى لتوليد الرمز'}
            </p>
            <p className="text-xs leading-relaxed text-slate-300">
              أدخل نصاً أو رابطاً، أو ارفع صورة عبر ImgBB ليظهر رمز QR هنا فوراً.
            </p>
          </div>
        )}
      </div>

      <div
        className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
          lowContrast
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : 'border-white/10 bg-slate-950/40 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {lowContrast ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
          )}
          <span className={lowContrast ? 'font-medium text-amber-200' : 'text-slate-200'}>
            {lowContrast
              ? 'تباين منخفض — قد يصعب مسح الرمز بالكاميرا'
              : 'تباين واضح وسريع القراءة'}
          </span>
        </div>
        <span className="font-mono font-medium text-slate-300 tabular-nums">
          {contrastRatio.toFixed(1)}:1
        </span>
      </div>

      {hasContent && (
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>المحتوى المرمّز</span>
            <span className="font-mono tabular-nums">{trimmedContent.length} حرف</span>
          </div>
          <p
            dir="auto"
            className="truncate rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-xs text-slate-200"
            title={trimmedContent}
          >
            {trimmedContent}
          </p>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={!hasContent || Boolean(renderError)}
          className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>تحميل الباركود عالي الجودة (PNG)</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopyImage}
            disabled={!hasContent || Boolean(renderError)}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap"
          >
            {copiedImage ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>تم نسخ الصورة</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ الصورة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            disabled={!hasContent}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap"
          >
            {copiedContent ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>تم نسخ النص</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ المحتوى</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
