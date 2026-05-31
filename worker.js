export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isVideo = /\.(mp4|webm|ogg|m4v)$/i.test(url.pathname);
    const response = await env.ASSETS.fetch(request);
    if (!isVideo) return response;
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', 'no-store');
    newHeaders.set('Accept-Ranges', 'bytes');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
};