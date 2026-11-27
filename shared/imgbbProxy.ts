export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

interface ImgbbApiPayload {
  success?: boolean;
  status?: number;
  data?: {
    id?: string;
    title?: string;
    url?: string;
    display_url?: string;
    thumb?: {
      url?: string;
    };
  };
  error?: {
    message?: string;
    code?: number;
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

function isValidApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey) return false;
  const trimmed = apiKey.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== 'YOUR_IMGBB_API_KEY_HERE' &&
    trimmed !== 'MY_IMGBB_API_KEY'
  );
}

export function handleUploadOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function handleUploadPost(
  request: Request,
  rawApiKey: string | undefined
): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    const outgoingForm = new FormData();
    let resolvedKey = isValidApiKey(rawApiKey) ? rawApiKey.trim() : '';

    if (contentType.includes('multipart/form-data')) {
      const incomingForm = await request.formData();
      const imageEntry = incomingForm.get('image');
      const nameEntry = incomingForm.get('name');
      const formKeyEntry = incomingForm.get('key');

      if (!resolvedKey && typeof formKeyEntry === 'string' && isValidApiKey(formKeyEntry)) {
        resolvedKey = formKeyEntry.trim();
      }

      if (!resolvedKey) {
        return jsonResponse(
          {
            error: 'MISSING_API_KEY',
            message:
              'لم يتم تعيين مفتاح خدمة استضافة الصور (VITE_IMGBB_API_KEY) في متغيرات البيئة.',
          },
          500
        );
      }

      outgoingForm.append('key', resolvedKey);

      if (!imageEntry) {
        return jsonResponse(
          {
            error: 'INVALID_IMAGE',
            message: 'لم يتم إرفاق أي صورة في الطلب.',
          },
          400
        );
      }

      if (typeof imageEntry === 'string') {
        const cleanBase64 = imageEntry.includes(',')
          ? imageEntry.split(',')[1]
          : imageEntry;
        if (!cleanBase64.trim()) {
          return jsonResponse(
            {
              error: 'INVALID_IMAGE',
              message: 'بيانات الصورة المرسلة غير صالحة.',
            },
            400
          );
        }
        outgoingForm.append('image', cleanBase64.trim());
      } else {
        if (imageEntry.size === 0) {
          return jsonResponse(
            {
              error: 'EMPTY_IMAGE',
              message: 'ملف الصورة المرفق فارغ.',
            },
            400
          );
        }

        if (imageEntry.size > MAX_IMAGE_BYTES) {
          return jsonResponse(
            {
              error: 'FILE_TOO_LARGE',
              message: 'حجم الصورة يتجاوز الحد المسموح به (32 ميجابايت).',
            },
            413
          );
        }

        if (imageEntry.type && !imageEntry.type.startsWith('image/')) {
          return jsonResponse(
            {
              error: 'UNSUPPORTED_TYPE',
              message: 'نوع الملف المرسل غير مدعوم. يرجى اختيار صورة صالحة.',
            },
            400
          );
        }

        outgoingForm.append('image', imageEntry, imageEntry.name || 'image.png');
      }

      if (typeof nameEntry === 'string' && nameEntry.trim()) {
        outgoingForm.append('name', nameEntry.trim().slice(0, 80));
      }
    } else if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as {
        imageBase64?: string;
        image?: string;
        name?: string;
        key?: string;
      } | null;

      if (!resolvedKey && typeof body?.key === 'string' && isValidApiKey(body.key)) {
        resolvedKey = body.key.trim();
      }

      if (!resolvedKey) {
        return jsonResponse(
          {
            error: 'MISSING_API_KEY',
            message:
              'لم يتم تعيين مفتاح خدمة استضافة الصور (VITE_IMGBB_API_KEY) في متغيرات البيئة.',
          },
          500
        );
      }

      outgoingForm.append('key', resolvedKey);

      const rawImage = (body?.imageBase64 || body?.image || '').trim();
      const cleanBase64 = rawImage.includes(',') ? rawImage.split(',')[1] : rawImage;

      if (!cleanBase64) {
        return jsonResponse(
          {
            error: 'INVALID_IMAGE',
            message: 'بيانات الصورة المرسلة غير صالحة.',
          },
          400
        );
      }

      const estimatedBytes = Math.ceil((cleanBase64.length * 3) / 4);
      if (estimatedBytes > MAX_IMAGE_BYTES) {
        return jsonResponse(
          {
            error: 'FILE_TOO_LARGE',
            message: 'حجم الصورة يتجاوز الحد المسموح به (32 ميجابايت).',
          },
          413
        );
      }

      outgoingForm.append('image', cleanBase64);
      if (typeof body?.name === 'string' && body.name.trim()) {
        outgoingForm.append('name', body.name.trim().slice(0, 80));
      }
    } else {
      return jsonResponse(
        {
          error: 'UNSUPPORTED_CONTENT_TYPE',
          message: 'صيغة الطلب غير مدعومة. يجب إرسال الصورة عبر FormData أو JSON.',
        },
        400
      );
    }

    const upstreamRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: outgoingForm,
    });

    const rawText = await upstreamRes.text();
    let result: ImgbbApiPayload | null = null;
    if (rawText) {
      try {
        result = JSON.parse(rawText) as ImgbbApiPayload;
      } catch {
        result = null;
      }
    }

    if (!upstreamRes.ok || !result?.success || !result.data?.url) {
      return jsonResponse(
        {
          error: 'UPSTREAM_UPLOAD_FAILED',
          message:
            result?.error?.message ||
            `تعذر إتمام رفع الصورة لدى مزود الاستضافة (رمز الحالة: ${upstreamRes.status}).`,
        },
        upstreamRes.status >= 400 && upstreamRes.status < 600
          ? upstreamRes.status
          : 502
      );
    }

    return jsonResponse(
      {
        url: result.data.url,
        displayUrl: result.data.display_url || result.data.url,
        thumbUrl:
          result.data.thumb?.url || result.data.display_url || result.data.url,
      },
      200
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'خطأ غير معروف';
    return jsonResponse(
      {
        error: 'PROXY_ERROR',
        message: `حدث خطأ غير متوقع أثناء معالجة رفع الصورة: ${detail}`,
      },
      500
    );
  }
}
