// ============================================================================
// ضع مفتاح ImgBB API الخاص بك هنا أو داخل متغير البيئة VITE_IMGBB_API_KEY
// احصل على مفتاح مجاني من: https://api.imgbb.com/
// ============================================================================
export const IMGBB_API_KEY =
  (import.meta.env.VITE_IMGBB_API_KEY as string | undefined)?.trim() ||
  'YOUR_IMGBB_API_KEY_HERE';

export function isImgbbConfigured(): boolean {
  return (
    Boolean(IMGBB_API_KEY) &&
    IMGBB_API_KEY !== 'YOUR_IMGBB_API_KEY_HERE' &&
    IMGBB_API_KEY !== 'MY_IMGBB_API_KEY'
  );
}
