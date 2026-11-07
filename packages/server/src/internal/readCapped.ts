/**
 * Read a request body of at most `limit` bytes. `null` when it is larger: a declared `content-length` over the
 * limit is refused without reading, and a body without one (chunked) stops being read as soon as it passes it.
 */
export async function readCapped(
  raw: Pick<Request, "headers" | "body">,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(raw.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (raw.body === null) return new Uint8Array(0);
  const reader = raw.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    size += r.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(r.value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
