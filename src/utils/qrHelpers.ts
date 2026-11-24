export interface ColorPreset {
  id: string;
  name: string;
  fg: string;
  bg: string;
}

export interface TextPreset {
  id: string;
  label: string;
  value: string;
}

export interface HistoryItem {
  id: string;
  mode: 'text' | 'image' | 'file';
  content: string;
  label?: string;
  fgColor: string;
  bgColor: string;
  createdAt: number;
}

export const QR_COLOR_PRESETS: ColorPreset[] = [
  {id: 'classic', name: 'كلاسيكي', fg: '#0F172A', bg: '#FFFFFF'},
  {id: 'royal', name: 'أزرق ملكي', fg: '#1D4ED8', bg: '#FFFFFF'},
  {id: 'emerald', name: 'زمردي', fg: '#065F46', bg: '#F8FAFC'},
  {id: 'crimson', name: 'عنابي', fg: '#9F1239', bg: '#FFF1F2'},
  {id: 'midnight', name: 'ليلي', fg: '#F8FAFC', bg: '#0F172A'},
];

export const QUICK_TEXT_PRESETS: TextPreset[] = [
  {id: 'website', label: 'رابط موقع', value: 'https://example.com'},
  {
    id: 'contact',
    label: 'بطاقة تواصل',
    value: 'الاسم: أحمد محمد\nالهاتف: +966500000000\nالبريد: info@example.com',
  },
  {
    id: 'wifi',
    label: 'شبكة واي فاي',
    value: 'WIFI:T:WPA;S:StudioNetwork;P:SecurePass2026;;',
  },
];

export function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function normalizeHex(input: string, fallback: string): string {
  const cleaned = input.trim();
  const withHash = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
  if (isValidHexColor(withHash)) {
    return withHash.toUpperCase();
  }
  return fallback;
}

function hexToRgb(hex: string): {r: number; g: number; b: number} | null {
  if (!isValidHexColor(hex)) return null;
  const raw = hex.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function relativeLuminance({r, g, b}: {r: number; g: number; b: number}): number {
  const transform = (channel: number) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function calculateContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 21;
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatBytesArabic(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}
