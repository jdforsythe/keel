// Preload for the interruption cases (not a test file; create-bin-support.ts `runHeld`). It lets the first project file be written, then holds the second
// write forever with the event loop alive (standard input resumed), so a signal reaches the bin "after the first file is written" with no timer.
// Everything the bin writes goes through `fs` or `fs/promises` writes, opens or copies: those are held; nothing else is touched. `.keel-create` writes pass.
import fs from "node:fs";
import fsp from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

const ready = process.env.KEEL_CONFORMANCE_READY ?? "";
let projectWrites = 0;

const pathOf = (v: unknown): string => (typeof v === "string" ? v : v instanceof URL ? v.pathname : "");

function hold(target: object, name: string, destination: number, callback: boolean): void {
  const original: unknown = Reflect.get(target, name);
  if (typeof original !== "function") return;
  Reflect.set(target, name, (...args: unknown[]): unknown => {
    const path = pathOf(args[destination]);
    if (path === "" || path.endsWith(".keel-create") || path === ready) return Reflect.apply(original, target, args);
    projectWrites += 1;
    if (projectWrites < 2) return Reflect.apply(original, target, args);
    fs.writeFileSync(ready, path);
    process.stdin.resume();
    return callback ? undefined : new Promise<never>(() => {});
  });
}

for (const [name, destination] of [
  ["writeFile", 0],
  ["appendFile", 0],
  ["copyFile", 1],
  ["open", 0],
] as const) {
  hold(fsp, name, destination, false);
  hold(fs, name, destination, true);
}
syncBuiltinESMExports();
