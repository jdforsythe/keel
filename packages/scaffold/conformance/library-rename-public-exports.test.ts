// Spec: k.scaffold, clause "In a fresh library, `codemod rename Example Chart` makes `module.ts` `public.exports` name `Chart`, and `keel check`, clean before, is clean after."
// The `keel` binary over the library `create-app` writes (scaffold-needs-support.ts), compact output. Seed 1337 is not drawn: one fixed rename.
// ASSUMED: `module.ts` is the library's own, at the folder's root; "name `Chart`" is `Chart` present and `Example` absent from the `public: { exports: [...] }` list.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";
import { BOUND, cleanAll, fresh, keelCompact } from "./scaffold-needs-support.ts";

afterAll(cleanAll);

const exportsOf = (text: string): string => /exports\s*:\s*\[([^\]]*)\]/.exec(text)?.[1] ?? "";

it(
  "In a fresh library, `codemod rename Example Chart` makes `module.ts` `public.exports` name `Chart`, and `keel check`, clean before, is clean after",
  () => {
    const dir = fresh("library");
    const before = keelCompact(dir, ["check"]);
    expect(before.status, before.stdout + before.stderr).toBe(0);
    expect(exportsOf(readFileSync(join(dir, "module.ts"), "utf8"))).toContain("Example");
    const r = keelCompact(dir, ["codemod", "rename", "Example", "Chart"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const names = exportsOf(readFileSync(join(dir, "module.ts"), "utf8"));
    expect(names).toContain("Chart");
    expect(names).not.toContain("Example");
    const after = keelCompact(dir, ["check"]);
    expect(after.status, after.stdout + after.stderr).toBe(0);
    expect(after.stdout + after.stderr).not.toMatch(/\b[EW]\d{4}\b/);
  },
  BOUND,
);
