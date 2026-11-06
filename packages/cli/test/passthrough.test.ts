// k.check Conformance, through the cli: the json diagnostic `keel check` emits for a compiler fixture is
// byte-identical to the one the compiler emits. Needs the real `@keel/check` pipeline.
import { compile } from "@keel/compiler";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";

const files = [
  { path: "src/C.tsx", source: `export default function C() { return <a href="javascript:alert(1)">x</a> }\n` },
];

describe("compiler passthrough", () => {
  it("keel check --format=json carries the compiler's diagnostic byte for byte", async () => {
    const compiled = compile(files).diagnostics;
    expect(compiled.length).toBeGreaterThan(0);
    const out = (await run(["check", "--format=json"], { cwd: "/work/app", files })).stdout.split("\n");
    for (const c of compiled) expect(out).toContain(JSON.stringify({ kind: "diag", ...c }));
  });
});
