import {handleUploadOptions, handleUploadPost} from '../../shared/imgbbProxy';

interface PagesContext {
  request: Request;
  env: {
    VITE_IMGBB_API_KEY?: string;
    IMGBB_API_KEY?: string;
  };
}

export async function onRequestOptions(): Promise<Response> {
  return handleUploadOptions();
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  return handleUploadPost(
    context.request,
    context.env.VITE_IMGBB_API_KEY || context.env.IMGBB_API_KEY
  );
}
