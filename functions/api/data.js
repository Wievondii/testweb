// Image upload relay: receives raw binary, forwards to image host
const IMAGE_HOST = 'https://image.20041126.xyz';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Mime',
  };
}

export async function onRequest(context) {
  const { request, url } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== 'POST') {
    return new Response('POST only', {
      status: 405,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
    });
  }

  try {
    const filename = request.headers.get('X-Filename') || 'image.jpg';
    const mimeType = request.headers.get('X-Mime') || 'image/jpeg';
    const body = await request.arrayBuffer();

    if (!body || body.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'No data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // Build multipart form
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    const crlf = '\r\n';
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}Content-Type: ${mimeType}${crlf}${crlf}`;
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);
    const footerBytes = encoder.encode(`${crlf}--${boundary}--${crlf}`);

    const multipart = new Uint8Array(headerBytes.length + body.byteLength + footerBytes.length);
    multipart.set(headerBytes, 0);
    multipart.set(new Uint8Array(body), headerBytes.length);
    multipart.set(footerBytes, headerBytes.length + body.byteLength);

    const upstream = await fetch(IMAGE_HOST + '/api/enableauthapi/tgchannel', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipart,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
}
