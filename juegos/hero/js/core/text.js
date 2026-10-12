// Decodificación de texto tolerante: los charts de la comunidad vienen en
// UTF-8 (con o sin BOM), UTF-16 o ANSI (Windows-1252).
export function decodeText(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// Clone Hero permite "rich text" estilo Unity en nombres: <color=#f00>, <b>, <size=..>
export function stripTags(s) {
  return String(s ?? '').replace(/<\/?[a-z]+(=[^>]*)?>/gi, '').trim();
}
