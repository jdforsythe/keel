// A superseded build-time evaluation (`keel dev`, k.evaluator End): an aborted signal ends the bundle at its next app
// file, so nothing more compiles and no evaluator starts, and the evaluation rejects with the signal's reason, a
// syntax error in a file not yet compiled included.
import fs from "node:fs";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, expect, it } from "vitest";
import { evaluateProject } from "../src/internal/evaluateProject.ts";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
beforeEach(() => {
  root = tempDir(".tmp-abort-", import.meta.dirname);
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  write("modules/a/routes.ts", 'import { x } from "./x.ts";\nexport const routes = x;\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it(
  "rejects with the signal's reason, before an unparsable file is compiled",
  { timeout: fixedTime(30000) },
  async () => {
    write("modules/a/x.ts", "export const x = (;\n");
    const controller = new AbortController();
    const reason = new Error("superseded by the next change");
    controller.abort(reason);
    await expect(
      evaluateProject({
        root,
        tokensFile: undefined,
        routesFiles: ["modules/a/routes.ts"],
        usages: [],
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
  },
);

it("without a signal, the same project reports the file's E1000", { timeout: fixedTime(30000) }, async () => {
  write("modules/a/x.ts", "export const x = (;\n");
  const r = await evaluateProject({ root, tokensFile: undefined, routesFiles: ["modules/a/routes.ts"], usages: [] });
  expect(r.problems.some((p) => p.startsWith("E1000 modules/a/x.ts"))).toBe(true);
});
