import { attempted } from "./attempted.ts";

const LINE = "keel.unexpected log write threw, records lost (once per process)\n";
let noted = false;

/**
 * The last resort when the app's `log.write` throws on the last resort's own `diag`: one fixed line to stderr, at most
 * once per process, so a log sink that always throws cannot flood stderr. The line holds no thrown value and nothing of
 * the request. Where `process.stderr` does not exist, or its `write` throws, nothing is written. Never throws.
 */
export function logUnwritable(): void {
  if (noted) return;
  noted = true;
  attempted(() => {
    const proc: unknown = Reflect.get(globalThis, "process");
    const stderr: unknown = typeof proc === "object" && proc !== null ? Reflect.get(proc, "stderr") : undefined;
    const write: unknown = typeof stderr === "object" && stderr !== null ? Reflect.get(stderr, "write") : undefined;
    if (typeof write === "function") Reflect.apply(write, stderr, [LINE]);
  });
}
