// Image upload relay: accepts form-urlencoded POST, forwards to image host
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
    const formData = await request.formData();
    const encoded = formData.get('content') || '';

    if (!encoded) {
      return new Response('No data', {
        status: 400,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
      });
    }

    // Restore base64 padding
    let padded = encoded;
    while (padded.length % 4 !== 0) padded += '=';

    // Decode outer base64
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);

    // Restore inner base64 padding
    let imgB64 = parsed.d || '';
    while (imgB64.length % 4 !== 0) imgB64 += '=';

    const filename = parsed.n || 'image.jpg';
    const mimeType = parsed.t || 'image/jpeg';

    // Decode image base64
    const raw = atob(imgB64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Build multipart form for upstream
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const crlf = '\r\n';
    let header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}Content-Type: ${mimeType}${crlf}${crlf}`;

    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);
    const footerBytes = encoder.encode(`${crlf}--${boundary}--${crlf}`);

    const body = new Uint8Array(headerBytes.length + bytes.length + footerBytes.length);
    body.set(headerBytes, 0);
    body.set(bytes, headerBytes.length);
    body.set(footerBytes, headerBytes.length + bytes.length);

    const upstream = await fetch(IMAGE_HOST + '/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
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
