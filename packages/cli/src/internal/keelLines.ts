/** A Keel-coded line the Vite plugin warns with (`[plugin keel] keel: W1005 ...`). */
const LINE = /\bkeel: ([EWI]\d{4} .*)$/;
/** SGR color codes Vite wraps warnings in on a terminal. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * Binary only: the Keel diagnostics in a successful `vite build`'s output, one per line, deduped, in order: a
 * forged or stale `routes.json` the build rewrote (W1005, rfc:0055) and build-time evaluation problems (E1006,
 * E1807). `keel build` prints them; the rest of Vite's output stays silent on success (OUTPUT.md).
 */
export function keelLines(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.replace(ANSI, "").split("\n")) {
    const m = LINE.exec(line);
    if (m?.[1] !== undefined) out.add(`${m[1].trimEnd()}\n`);
  }
  return [...out];
}
