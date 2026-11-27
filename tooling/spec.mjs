// pnpm spec [<area> | <id> | --for <key>]: what `keel docs` prints in the Keel repo (k.docs The Keel repo), through
// the same operation: the map of areas, one area's sections, one section, or what a code, code block, API name or
// glossary term leads to. Output follows docs/OUTPUT.md (compact unless --format says otherwise).
import path from "node:path";
import { hostIo } from "../packages/cli/src/internal/hostIo.ts";
import { run } from "../packages/cli/src/run.ts";

process.chdir(path.join(import.meta.dirname, ".."));
const r = await run(["docs", ...process.argv.slice(2)], hostIo(false));
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exitCode = r.code;
