/**
 * Zero-dependency multipart/form-data parser.
 * Buffers are kept in memory and written through store.saveUpload, which
 * sanitises filenames before they ever touch the filesystem (docs/05 §4).
 */

function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('MULTIPART_BOUNDARY_MISSING');
  const boundary = Buffer.from(`--${(m[1] || m[2]).trim()}`);

  const parts = [];
  let start = buffer.indexOf(boundary);
  if (start < 0) return { fields: {}, files: [] };
  start += boundary.length;

  while (start < buffer.length) {
    if (buffer.slice(start, start + 2).toString() === '--') break;
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

    const headerEnd = buffer.indexOf('\r\n\r\n', start);
    if (headerEnd < 0) break;
    const headerBlock = buffer.slice(start, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;

    let next = buffer.indexOf(boundary, bodyStart);
    if (next < 0) next = buffer.length;
    let bodyEnd = next;
    if (buffer.slice(bodyEnd - 2, bodyEnd).toString() === '\r\n') bodyEnd -= 2;

    const headers = {};
    for (const line of headerBlock.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
    const disp = headers['content-disposition'] || '';
    const name = /name="([^"]*)"/i.exec(disp)?.[1] || null;
    const filename = /filename="([^"]*)"/i.exec(disp)?.[1] || null;
    const body = buffer.slice(bodyStart, bodyEnd);

    if (filename !== null) {
      if (body.length) parts.push({ kind: 'file', name, filename, content_type: headers['content-type'] || 'application/octet-stream', data: body });
    } else if (name) {
      parts.push({ kind: 'field', name, value: body.toString('utf8') });
    }

    start = next + boundary.length;
  }

  const fields = {};
  const files = [];
  for (const p of parts) {
    if (p.kind === 'field') fields[p.name] = p.value;
    else files.push({ field: p.name, filename: p.filename, mime: p.content_type, data: p.data });
  }
  return { fields, files };
}

function readBody(req, limitBytes = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { reject(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = { parseMultipart, readBody };
