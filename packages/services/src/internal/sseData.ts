const NL = 10;
const CR = 13;
const DATA = [100, 97, 116, 97, 58];

/** The bytes of a line as one array, without its `\r`. */
const joined = (parts: readonly Uint8Array[], size: number): Uint8Array => {
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out[size - 1] === CR ? out.subarray(0, size - 1) : out;
};

/**
 * The `data` of each event in a `text/event-stream` body, in order: `data:` lines (one optional space after the colon)
 * joined by a blank line; comment (`:`) and other field lines are skipped. One event's line block, from the byte after
 * the blank line that ended the one before (or the body's start) through the blank line that ends it, is at most
 * `maxBytes` bytes, every line, comment and line end counted. Once a block passes `maxBytes` before its blank line
 * comes, the body is cancelled and `null` is yielded, then the generator ends. The body is read once, in steps linear
 * in its bytes: each chunk is scanned for line ends from its start, and a line is held only up to `maxBytes`. Ends
 * with the body, or when `signal` aborts (the body is cancelled). A body that errors throws.
 */
export async function* sseData(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  maxBytes: number,
): AsyncGenerator<string | null> {
  const reader = body.getReader();
  const stop = (): void => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", stop, { once: true });
  const dec = new TextDecoder();
  let block = 0;
  let line: Uint8Array[] = [];
  let size = 0;
  let data: string[] = [];
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done || signal.aborted) return;
      const chunk = r.value;
      const events: string[] = [];
      let over = false;
      let from = 0;
      while (from < chunk.length) {
        const nl = chunk.indexOf(NL, from);
        const end = nl < 0 ? chunk.length : nl + 1;
        block += end - from;
        if (block > maxBytes) {
          over = true;
          break;
        }
        const stopAt = nl < 0 ? end : nl;
        line.push(chunk.slice(from, stopAt));
        size += stopAt - from;
        from = end;
        if (nl < 0) break;
        const bytes = joined(line, size);
        line = [];
        size = 0;
        if (bytes.length === 0) {
          block = 0;
          if (data.length > 0) {
            events.push(data.join("\n"));
            data = [];
          }
        } else if (DATA.every((b, i) => bytes[i] === b)) {
          const text = dec.decode(bytes);
          data.push(text.slice(text.startsWith("data: ") ? 6 : 5));
        }
      }
      if (over) await reader.cancel().catch(() => undefined);
      yield* events;
      if (over) {
        yield null;
        return;
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
