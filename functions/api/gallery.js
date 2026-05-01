// Public endpoint: returns photos without auth (for gallery page)
const KV_KEY = 'gallery_photos';

export async function onRequest(context) {
  const { env } = context;
  try {
    if (!env.PHOTOS_KV) {
      return new Response('[]', {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const data = await env.PHOTOS_KV.get(KV_KEY, { type: 'json' });
    const photos = Array.isArray(data) ? data : [];
    return new Response(JSON.stringify(photos), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response('[]', {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
