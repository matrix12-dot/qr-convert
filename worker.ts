import {handleUploadOptions, handleUploadPost} from './shared/imgbbProxy';

export interface WorkerEnv {
  IMGBB_API_KEY?: string;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '');

    if (pathname === '/api/upload' || pathname === '/api/upload-image') {
      if (request.method === 'OPTIONS') {
        return handleUploadOptions();
      }
      if (request.method === 'POST') {
        return handleUploadPost(request, env.IMGBB_API_KEY);
      }
      return new Response(
        JSON.stringify({
          error: 'METHOD_NOT_ALLOWED',
          message: 'طريقة الطلب غير مدعومة لهذا المسار.',
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', {status: 404});
  },
};
