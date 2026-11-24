/** The `keel_storage` notification payloads for `keys` (sorted, store keys only) under `token`: JSON `{"o":<token>,"k":[...]}`, as few as keep each at most 7,900 bytes. Never a value. */
export function notifyPayloads(token: string, keys: readonly string[]): string[] {
  const head = `{"o":${token},"k":[`;
  const out: string[] = [];
  let chunk: string[] = [];
  let size = Buffer.byteLength(head) + 2;
  for (const key of keys) {
    const text = JSON.stringify(key);
    const add = Buffer.byteLength(text) + 1;
    if (chunk.length > 0 && size + add > 7_900) {
      out.push(`${head}${chunk.join(",")}]}`);
      chunk = [];
      size = Buffer.byteLength(head) + 2;
    }
    chunk.push(text);
    size += add;
  }
  if (chunk.length > 0) out.push(`${head}${chunk.join(",")}]}`);
  return out;
}
