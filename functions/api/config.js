const DEFAULT_CONFIG = {
  galleryTitle: 'Photography Exhibition',
  gallerySubtitle: 'A curated collection of captured moments',
};

const KV_KEY = 'gallery_config';

async function getConfig(env) {
  if (!env.PHOTOS_KV) return DEFAULT_CONFIG;
  const data = await env.PHOTOS_KV.get(KV_KEY, { type: 'json' });
  return data || DEFAULT_CONFIG;
}

async function saveConfig(env, config) {
  if (!env.PHOTOS_KV) throw new Error('KV not configured');
  await env.PHOTOS_KV.put(KV_KEY, JSON.stringify(config));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const config = await getConfig(env);
    return new Response(JSON.stringify(config), {
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
    const body = await request.json();
    const config = { ...DEFAULT_CONFIG, ...body };
    await saveConfig(env, config);
    return new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}
