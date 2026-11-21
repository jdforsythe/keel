// `Text role` in the compiler (k.ui Base elements, k.compiler Artifacts): a literal `status` or `alert` is the
// element's role in ids.json and a11y.json, so the harness's E1702 agrees with what `Text` writes.
import { describe, expect, it } from "vitest";
import { compile } from "../src/index.ts";

const page = (attrs: string): string =>
  `import { Text } from '@keel/ui'\nexport default function C() { return <Text id="c.t" ${attrs}>Saved</Text> }\n`;

describe("Text role in the compiler", () => {
  it.each(["status", "alert"])("records role %s for a literal role", (role) => {
    const r = compile([{ path: "modules/a/C.tsx", source: page(`role="${role}"`) }]);
    expect(r.diagnostics).toEqual([]);
    expect(r.artifacts["ids.json"]["c.t"]).toMatchObject({ tag: "span", role, component: "C" });
    expect(r.artifacts["a11y.json"]["c.t"]).toMatchObject({ role, tag: "span" });
  });

  it("records the tag's role without one, and none for a computed role", () => {
    const plain = compile([{ path: "modules/a/C.tsx", source: page('as="p"') }]);
    const computed = compile([{ path: "modules/a/C.tsx", source: page("role={kind}") }]);
    expect(plain.artifacts["a11y.json"]["c.t"]?.role).not.toBe("status");
    expect(computed.artifacts["a11y.json"]["c.t"]?.role ?? null).toBeNull();
  });
});
