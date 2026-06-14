export async function onRequest({ request, next }) {
  const response = await next();
  const host = new URL(request.url).hostname;

  if (host.endsWith('.pages.dev')) {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}
