const DEFAULT_PASS_HASH = 'c4aa2044827b56283f132e21068030b7b1846dbd552eb1d2ceefaba11dca6ce0'; // SHA-256 of "k423"
const KV_KEY = 'gallery_photos';

async function getPhotos(env) {
  if (!env.PHOTOS_KV) return [];
  const data = await env.PHOTOS_KV.get(KV_KEY, { type: 'json' });
  return Array.isArray(data) ? data : [];
}

async function savePhotos(env, photos) {
  if (!env.PHOTOS_KV) throw new Error('KV not configured');
  await env.PHOTOS_KV.put(KV_KEY, JSON.stringify(photos));
}

async function getPasswordHash(env) {
  if (!env.PHOTOS_KV) return DEFAULT_PASS_HASH;
  const stored = await env.PHOTOS_KV.get('gallery_password_hash');
  return stored || DEFAULT_PASS_HASH;
}

async function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth) return false;
  const hash = auth.replace('Bearer ', '');
  const expected = await getPasswordHash(env);
  return hash === expected;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET now requires auth too (admin reads with auth, gallery uses /api/gallery)
export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (!await checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const photos = await getPhotos(env);
    return new Response(JSON.stringify(photos), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!await checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const photo = await request.json();
    if (!photo.url || !photo.title) {
      return new Response(JSON.stringify({ error: 'url and title required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const photos = await getPhotos(env);
    photo.id = photo.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    photo.date = photo.date || new Date().toISOString().split('T')[0];
    photos.unshift(photo);
    await savePhotos(env, photos);
    return new Response(JSON.stringify(photo), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    if (!await checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const updated = await request.json();
    if (!updated.id) {
      return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const photos = await getPhotos(env);
    const idx = photos.findIndex(p => p.id === updated.id);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    photos[idx] = { ...photos[idx], ...updated };
    await savePhotos(env, photos);
    return new Response(JSON.stringify(photos[idx]), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  try {
    if (!await checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const { id } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const photos = await getPhotos(env);
    const filtered = photos.filter(p => p.id !== id);
    await savePhotos(env, filtered);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}
