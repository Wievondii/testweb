// Auth check endpoint: validates password hash
const DEFAULT_PASS_HASH = 'c4aa2044827b56283f132e21068030b7b1846dbd552eb1d2ceefaba11dca6ce0';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const auth = request.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const hash = auth.replace('Bearer ', '');
    let expected = DEFAULT_PASS_HASH;

    if (env.PHOTOS_KV) {
      const stored = await env.PHOTOS_KV.get('gallery_password_hash');
      if (stored) expected = stored;
    }

    const valid = hash === expected;
    return new Response(JSON.stringify({ valid }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}
