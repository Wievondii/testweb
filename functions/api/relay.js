// Image upload relay: accepts text/plain POST, forwards to image host
const IMAGE_HOST = 'https://image.20041126.xyz';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequest(context) {
  const { request } = context;

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
    const contentType = request.headers.get('content-type') || '';

    let base64, filename, mimeType;

    if (contentType.includes('text/plain')) {
      // Text format: first line = filename, second line = mime, rest = base64
      const text = await request.text();
      const lines = text.split('\n');
      filename = (lines[0] || 'image.jpg').trim();
      mimeType = (lines[1] || 'image/jpeg').trim();
      base64 = (lines[2] || '').trim();
    } else if (contentType.includes('application/json')) {
      const parsed = await request.json();
      base64 = parsed.pack;
      filename = 'image.jpg';
      mimeType = 'image/jpeg';
    } else {
      return new Response('Unsupported content type', {
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
      });
    }

    if (!base64) {
      return new Response('No data', {
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
      });
    }

    // Decode base64
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Build multipart form
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const crlf = '\r\n';
    let header = '';
    header += `--${boundary}${crlf}`;
    header += `Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}`;
    header += `Content-Type: ${mimeType}${crlf}${crlf}`;

    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);
    const footerBytes = encoder.encode(`${crlf}--${boundary}--${crlf}`);

    const multipartBody = new Uint8Array(headerBytes.length + bytes.length + footerBytes.length);
    multipartBody.set(headerBytes, 0);
    multipartBody.set(bytes, headerBytes.length);
    multipartBody.set(footerBytes, headerBytes.length + bytes.length);

    const upstream = await fetch(IMAGE_HOST + '/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipartBody,
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
