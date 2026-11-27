// Child process for host-views.test.ts (not a test file): runs argv[3], JavaScript that sets `result`, after the
// evaluation bundle's head (`OBSERVE_BANNER`) as one module in the folder argv[2], in plain Node, and prints
// `{ result, probes, leaked }`: `leaked` lists what reached the real global object and `process.env`.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { OBSERVE_BANNER } from "../src/internal/OBSERVE_BANNER.ts";
import { UNRESOLVED_MARK } from "../src/internal/UNRESOLVED_MARK.ts";

const dir = process.argv[2] ?? "";
const code = process.argv[3] ?? "";
const file = path.join(dir, "evaluate.mjs");
fs.writeFileSync(
  file,
  `${OBSERVE_BANNER.replace(UNRESOLVED_MARK, "[]")}\nlet result;\n${code}\nexport { result };\nexport const observed = __keelObserved;\n`,
);
const m: unknown = await import(pathToFileURL(file).href);
const get = (k: string): unknown => (typeof m === "object" && m !== null ? Reflect.get(m, k) : undefined);
const observed = get("observed");
const leaked = [
  ...(Reflect.has(globalThis, "keelMark") ? ["globalThis.keelMark"] : []),
  ...(process.env.KEEL_MARK === undefined ? [] : ["process.env.KEEL_MARK"]),
];
const probes = typeof observed === "object" && observed !== null ? Reflect.get(observed, "probes") : [];
process.stdout.write(`${JSON.stringify({ result: get("result"), probes, leaked })}\n`);
