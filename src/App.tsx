import {useEffect, useState} from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeftRight,
  Download,
  History,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {FileUploader, UploadedFileInfo} from './components/FileUploader';
import {ImageUploader, UploadedImageInfo} from './components/ImageUploader';
import {ErrorCorrectionLevel, QrPreviewPanel} from './components/QrPreviewPanel';
import {
  HistoryItem,
  normalizeHex,
  QR_COLOR_PRESETS,
  QUICK_TEXT_PRESETS,
} from './utils/qrHelpers';

const HISTORY_STORAGE_KEY = 'qr_studio_history_v1';

export default function App() {
  const [mode, setMode] = useState<'text' | 'image' | 'file'>('text');
  const [textValue, setTextValue] = useState('https://example.com');
  const [uploadedImage, setUploadedImage] = useState<UploadedImageInfo | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);

  const [fgColor, setFgColor] = useState('#0F172A');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [fgInput, setFgInput] = useState('#0F172A');
  const [bgInput, setBgInput] = useState('#FFFFFF');

  const [exportSize, setExportSize] = useState<number>(1024);
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('M');

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as HistoryItem[];
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });


  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const activeContent =
    mode === 'text'
      ? textValue
      : mode === 'image'
        ? uploadedImage?.url || ''
        : uploadedFile?.url || '';

  const saveToHistory = (
    targetMode: 'text' | 'image' | 'file',
    content: string,
    label?: string
  ) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.content !== trimmed);
      const next: HistoryItem = {
        id: `${Date.now()}`,
        mode: targetMode,
        content: trimmed,
        label,
        fgColor,
        bgColor,
        createdAt: Date.now(),
      };
      return [next, ...filtered].slice(0, 6);
    });
  };

  const handleHeaderDownload = async () => {
    const trimmed = activeContent.trim();
    if (!trimmed) {
      document.getElementById('generator')?.scrollIntoView({behavior: 'smooth'});
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(trimmed, {
        width: exportSize,
        margin: 3,
        errorCorrectionLevel: errorLevel,
        type: 'image/png',
        color: {dark: fgColor, light: bgColor},
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-code-${exportSize}px-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      saveToHistory(mode, trimmed);
    } catch {
      // Handled inside preview panel
    }
  };

  const applyPresetColors = (fg: string, bg: string) => {
    setFgColor(fg);
    setFgInput(fg);
    setBgColor(bg);
    setBgInput(bg);
  };

  const swapColors = () => {
    applyPresetColors(bgColor, fgColor);
  };

  const handleFgInputChange = (val: string) => {
    setFgInput(val);
    const normalized = normalizeHex(val, '');
    if (normalized) setFgColor(normalized);
  };

  const handleBgInputChange = (val: string) => {
    setBgInput(val);
    const normalized = normalizeHex(val, '');
    if (normalized) setBgColor(normalized);
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    applyPresetColors(item.fgColor, item.bgColor);
    if (item.mode === 'image') {
      setMode('image');
      setUploadedImage({
        url: item.content,
        thumbUrl: item.content,
        fileName: item.label || 'صورة محفوظة',
        sizeBytes: 0,
      });
    } else if (item.mode === 'file') {
      setMode('file');
      setUploadedFile({
        id: item.id,
        url: item.content,
        fileName: item.label || 'ملف مرفق',
        sizeBytes: 0,
        mimeType: 'application/octet-stream',
      });
    } else {
      setMode('text');
      setTextValue(item.content);
    }
    document.getElementById('generator')?.scrollIntoView({behavior: 'smooth'});
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#060B19] text-slate-100">
      {/* Animated Ambient Mesh Background (compositor-only transforms) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="orb-animate-1 absolute -top-[18%] right-[-8%] h-[620px] w-[620px] rounded-full opacity-55"
          style={{
            background:
              'radial-gradient(circle at center, rgba(14, 165, 233, 0.42) 0%, rgba(29, 78, 216, 0.16) 48%, transparent 72%)',
          }}
        />
        <div
          className="orb-animate-2 absolute -bottom-[20%] left-[-10%] h-[680px] w-[680px] rounded-full opacity-50"
          style={{
            background:
              'radial-gradient(circle at center, rgba(13, 148, 136, 0.38) 0%, rgba(15, 118, 110, 0.14) 50%, transparent 74%)',
          }}
        />
        <div
          className="orb-animate-3 absolute top-[30%] left-[24%] h-[520px] w-[520px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle at center, rgba(59, 130, 246, 0.32) 0%, rgba(30, 58, 138, 0.12) 52%, transparent 72%)',
          }}
        />
        <div className="glass-grid-overlay absolute inset-0" />
      </div>

      {/* Foreground Glass Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top Bar Contract: 3 zones */}
        <header className="glass-header">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
            <a
              href="#top"
              className="font-display text-lg font-bold text-white whitespace-nowrap shrink-0"
            >
              استوديو كيو آر
            </a>

            <nav
              aria-label="التنقل الرئيسي"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
            >
              <a
                href="#generator"
                className="transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                المولّد
              </a>
              <a
                href="#colors"
                className="transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                الألوان
              </a>
              <a
                href="#export-options"
                className="transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                جودة التصدير
              </a>
              <a
                href="#history"
                className="transition-colors hover:text-white whitespace-nowrap shrink-0"
              >
                السجل
              </a>
            </nav>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleHeaderDownload}
                disabled={!activeContent.trim()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>تحميل PNG</span>
              </button>
            </div>
          </div>
        </header>

        <main id="top" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
          {/* Focused Editorial Intro */}
          <section className="mb-8 max-w-3xl space-y-2.5">
            <h1 className="font-display text-2xl font-bold text-white text-balance sm:text-3xl">
              مولّد رموز QR للنصوص والروابط والملفات
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              أنشئ رمز الاستجابة السريعة فوراً عبر إدخال أي نص أو رابط، أو رفع صورة عبر ImgBB، أو إرفاق ملفاتك لتوليد رابط تحميل مباشر بصيغة PNG عالية الجودة.
            </p>
          </section>

          {/* Main 2-Column Studio Workspace */}
          <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Controls Column (7 cols) */}
            <div className="glass-panel rounded-2xl divide-y divide-white/10 lg:col-span-7">
              {/* Section 1: Content Source */}
              <div id="generator" className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-bold text-white">1. مصدر المحتوى</h2>

                  {/* Segmented Mode Control */}
                  <div
                    role="tablist"
                    aria-label="نوع المحتوى"
                    className="inline-flex flex-wrap sm:flex-nowrap rounded-xl border border-white/10 bg-slate-950/50 p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'text'}
                      onClick={() => setMode('text')}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        mode === 'text'
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>نص أو رابط</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'image'}
                      onClick={() => setMode('image')}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        mode === 'image'
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>رفع صورة</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'file'}
                      onClick={() => setMode('file')}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        mode === 'file'
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>إرفاق ملف</span>
                    </button>
                  </div>
                </div>

                {mode === 'text' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="qr-text-input"
                        className="text-xs font-medium text-slate-300"
                      >
                        أدخل الرابط أو النص المطلوب تحويله
                      </label>
                      {textValue && (
                        <button
                          type="button"
                          onClick={() => setTextValue('')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 transition-colors hover:text-white whitespace-nowrap shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>مسح</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      id="qr-text-input"
                      rows={4}
                      dir="auto"
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="https://example.com أو أي نص عربي أو إنجليزي..."
                      className="w-full resize-y rounded-xl border border-white/12 bg-slate-950/45 px-3.5 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-400 focus:border-sky-400/70 focus:bg-slate-950/65 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">نماذج سريعة:</span>
                        {QUICK_TEXT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setTextValue(preset.value)}
                            className="rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.12] whitespace-nowrap shrink-0"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {textValue.length} حرف
                      </span>
                    </div>
                  </div>
                ) : mode === 'image' ? (
                  <ImageUploader
                    uploadedImage={uploadedImage}
                    onImageUploaded={(info) => {
                      setUploadedImage(info);
                      saveToHistory('image', info.url, info.fileName);
                    }}
                    onClearImage={() => setUploadedImage(null)}
                  />
                ) : (
                  <FileUploader
                    uploadedFile={uploadedFile}
                    onFileUploaded={(info) => {
                      setUploadedFile(info);
                      saveToHistory('file', info.url, info.fileName);
                    }}
                    onClearFile={() => setUploadedFile(null)}
                  />
                )}
              </div>

              {/* Section 2: Colors & Presets */}
              <div id="colors" className="p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-base font-bold text-white">
                    2. تخصيص الألوان
                  </h2>
                  <button
                    type="button"
                    onClick={swapColors}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.14] whitespace-nowrap shrink-0"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span>عكس الألوان</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Foreground Color */}
                  <div className="space-y-2">
                    <label
                      htmlFor="fg-hex-input"
                      className="block text-xs font-medium text-slate-300"
                    >
                      لون الباركود
                    </label>
                    <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-slate-950/45 p-2">
                      <input
                        type="color"
                        aria-label="اختيار لون الباركود"
                        value={fgColor}
                        onChange={(e) => {
                          const upper = e.target.value.toUpperCase();
                          setFgColor(upper);
                          setFgInput(upper);
                        }}
                        className="h-9 w-11 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0.5 shrink-0"
                      />
                      <input
                        id="fg-hex-input"
                        type="text"
                        dir="ltr"
                        maxLength={7}
                        value={fgInput}
                        onChange={(e) => handleFgInputChange(e.target.value)}
                        onBlur={() => setFgInput(fgColor)}
                        className="w-full bg-transparent font-mono text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Background Color */}
                  <div className="space-y-2">
                    <label
                      htmlFor="bg-hex-input"
                      className="block text-xs font-medium text-slate-300"
                    >
                      لون الخلفية
                    </label>
                    <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-slate-950/45 p-2">
                      <input
                        type="color"
                        aria-label="اختيار لون الخلفية"
                        value={bgColor}
                        onChange={(e) => {
                          const upper = e.target.value.toUpperCase();
                          setBgColor(upper);
                          setBgInput(upper);
                        }}
                        className="h-9 w-11 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0.5 shrink-0"
                      />
                      <input
                        id="bg-hex-input"
                        type="text"
                        dir="ltr"
                        maxLength={7}
                        value={bgInput}
                        onChange={(e) => handleBgInputChange(e.target.value)}
                        onBlur={() => setBgInput(bgColor)}
                        className="w-full bg-transparent font-mono text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-300">
                    تنسيقات ألوان جاهزة
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {QR_COLOR_PRESETS.map((preset) => {
                      const isSelected =
                        fgColor === preset.fg && bgColor === preset.bg;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPresetColors(preset.fg, preset.bg)}
                          className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'border-sky-400/70 bg-sky-400/15 text-sky-200'
                              : 'border-white/12 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'
                          }`}
                        >
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded border border-white/25"
                            style={{backgroundColor: preset.bg}}
                          >
                            <span
                              className="h-2 w-2 rounded-xs"
                              style={{backgroundColor: preset.fg}}
                            />
                          </span>
                          <span>{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 3: Resolution & Error Correction */}
              <div id="export-options" className="p-5 sm:p-6 space-y-5">
                <h2 className="text-base font-bold text-white">
                  3. إعدادات التصدير والدقة
                </h2>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-slate-300">
                      أبعاد صورة PNG
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-950/50 p-1">
                      {[512, 1024, 2048].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setExportSize(size)}
                          className={`min-h-[36px] rounded-lg px-2 py-1.5 font-mono text-xs font-medium transition-colors tabular-nums whitespace-nowrap ${
                            exportSize === size
                              ? 'bg-white/15 text-white shadow-sm'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-slate-300">
                      مستوى تصحيح الخطأ
                    </span>
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-slate-950/50 p-1">
                      {(
                        [
                          {level: 'M', label: 'متوسط'},
                          {level: 'Q', label: 'مرتفع'},
                          {level: 'H', label: 'أقصى'},
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.level}
                          type="button"
                          onClick={() => setErrorLevel(opt.level)}
                          className={`min-h-[36px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            errorLevel === opt.level
                              ? 'bg-white/15 text-white shadow-sm'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview Stage (5 cols) */}
            <div className="lg:col-span-5 lg:sticky lg:top-6">
              <QrPreviewPanel
                content={activeContent}
                mode={mode}
                fgColor={fgColor}
                bgColor={bgColor}
                exportSize={exportSize}
                errorLevel={errorLevel}
                onDownloadTriggered={() => saveToHistory(mode, activeContent)}
              />
            </div>
          </section>

          {/* Recent History Section */}
          <section id="history" className="glass-panel mt-10 rounded-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-300" />
                <h2 className="text-sm font-bold text-white">
                  الرموز المحفوظة محلياً
                </h2>
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-red-300 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>مسح السجل</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-300 sm:px-6">
                عند تحميل رمز QR أو رفع صورة عبر ImgBB سيظهر هنا لإعادة استخدامه بسرعة.
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => restoreHistoryItem(item)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-right transition-colors hover:bg-white/[0.05] sm:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/25"
                          style={{backgroundColor: item.bgColor}}
                        >
                          <span
                            className="h-3 w-3 rounded-xs"
                            style={{backgroundColor: item.fgColor}}
                          />
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p
                            dir="auto"
                            className="truncate text-sm font-medium text-slate-100"
                          >
                            {item.label ? `${item.label} — ${item.content}` : item.content}
                          </p>
                          <p className="text-xs text-slate-300">
                            {item.mode === 'image'
                              ? 'صورة ImgBB'
                              : item.mode === 'file'
                                ? 'ملف مرفق'
                                : 'نص أو رابط'}
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="tabular-nums">
                              {new Date(item.createdAt).toLocaleTimeString('ar-SA', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-medium text-sky-300 whitespace-nowrap shrink-0">
                        استعادة
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <footer className="mt-12 border-t border-white/10 bg-slate-950/45 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-300 sm:flex-row sm:px-6">
            <p>استوديو كيو آر — توليد رموز QR فورية بدقة عالية</p>
            <a
              href="https://t.me/STA_RK4"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="التواصل عبر تلكرام"
              className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-medium text-sky-300 transition-colors hover:border-sky-400/50 hover:bg-white/[0.12] hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>تواصل عبر تلكرام</span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
