import type { LspFrame } from "./LspFrame.ts";
import type { LspFramer } from "./LspFramer.ts";

const SEP = [13, 10, 13, 10];

const indexOfSep = (buf: Uint8Array): number => {
  for (let i = 0; i + 3 < buf.length; i++) if (SEP.every((b, j) => buf[i + j] === b)) return i;
  return -1;
};

/**
 * A Content-Length framer over a growing byte buffer; partial frames wait for more input. A header block without
 * `Content-Length` is skipped and reported as an error frame.
 */
export function createFramer(): LspFramer {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = new Uint8Array(0);
  return {
    push: (chunk) => {
      const bytes = typeof chunk === "string" ? enc.encode(chunk) : chunk;
      const next = new Uint8Array(buf.length + bytes.length);
      next.set(buf);
      next.set(bytes, buf.length);
      buf = next;
      const frames: LspFrame[] = [];
      for (;;) {
        const at = indexOfSep(buf);
        if (at < 0) break;
        const header = dec.decode(buf.subarray(0, at));
        const len = Number(/content-length:\s*(\d+)/i.exec(header)?.[1] ?? Number.NaN);
        if (!Number.isInteger(len)) {
          frames.push({ error: `malformed header: ${JSON.stringify(header.slice(0, 60))} has no Content-Length` });
          buf = buf.slice(at + 4);
          continue;
        }
        if (buf.length < at + 4 + len) break;
        frames.push({ body: dec.decode(buf.subarray(at + 4, at + 4 + len)) });
        buf = buf.slice(at + 4 + len);
      }
      return frames;
    },
  };
}
