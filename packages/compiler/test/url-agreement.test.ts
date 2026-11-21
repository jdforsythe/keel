// Compiler half of the URL agreement table (red-team 0084): for every guarded attribute and literal case,
// E1003 is reported exactly when the runtime (`@keel/runtime-dom/url`) renders about:blank, and the static
// template carries the runtime's value. The table lives with the runtime: packages/runtime-dom/test/urlCases.ts.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "@keel/compiler";
import { isSafeUrl, safeUrl } from "@keel/runtime-dom/url";
import { repoRoot } from "@keel/tooling/repo-root";
import { describe, expect, it } from "vitest";

const cases: typeof import("../../runtime-dom/test/urlCases.ts") = await import(
  pathToFileURL(path.join(repoRoot(import.meta.dirname), "packages", "runtime-dom", "test", "urlCases.ts")).href
);
const { URL_CASES, URL_CASE_ATTRS, expectSafe } = cases;

const compileOne = (source: string) => compile([{ path: "C.tsx", source }]);

describe("URL agreement table: the compiler", () => {
  for (const { tag, attr } of URL_CASE_ATTRS) {
    for (const c of URL_CASES) {
      it(`${tag} ${attr}: ${c.label}`, () => {
        const safe = expectSafe(attr, c);
        expect(isSafeUrl(attr, c.value)).toBe(safe);
        const literal = c.jsx ?? `{${JSON.stringify(c.value)}}`;
        const r = compileOne(`export default function C() { return <${tag} ${attr}=${literal}></${tag}> }`);
        const e1003 = r.diagnostics.filter((d) => d.code === "E1003");
        expect(e1003).toHaveLength(safe ? 0 : 1);
        const code = r.outputs[0]?.code ?? "";
        if (!safe) expect(code).toContain(`${attr}=\\"about:blank\\"`);
        expect(safeUrl(attr, c.value) === "about:blank").toBe(!safe);
      });
    }
  }
});

describe("E1003 fix and base elements", () => {
  it("poster with a javascript: URL gets E1003 and a fix that removes the attribute", () => {
    const source = `export default function C() {\n  return <video poster="javascript:alert(1)" src="https://x.test/v.mp4"></video>\n}\n`;
    const [d] = compileOne(source).diagnostics;
    expect(d?.code).toBe("E1003");
    expect(d?.message).toBe("poster is a literal script/data URL; it renders as about:blank");
    expect(d?.fix).toBe(
      [
        "--- a/C.tsx",
        "+++ b/C.tsx",
        "@@ -1,3 +1,3 @@",
        " export default function C() {",
        '-  return <video poster="javascript:alert(1)" src="https://x.test/v.mp4"></video>',
        '+  return <video src="https://x.test/v.mp4"></video>',
        " }",
      ].join("\n"),
    );
  });

  it("srcdoc is rejected in any form, static or dynamic, with a removal fix", () => {
    for (const v of ['"<b>x</b>"', "{html}", '""']) {
      const [d, ...rest] = compileOne(
        `export default function C() { return <iframe srcdoc=${v}></iframe> }`,
      ).diagnostics;
      expect(rest).toEqual([]);
      expect(d?.code).toBe("E1003");
      expect(d?.message).toBe("srcdoc is raw HTML; it renders as about:blank");
      expect(d?.fix).toContain("+export default function C() { return <iframe></iframe> }");
    }
  });

  it("attribute names match case-insensitively, as the runtime does", () => {
    const d = compileOne(`export default function C() { return <a HREF="vbscript:x">x</a> }`).diagnostics;
    expect(d.map((x) => x.code)).toEqual(["E1003"]);
  });

  it("Link to (required) gets no removal fix; Image src does", () => {
    const UI = `import { Link, Image } from '@keel/ui'\n`;
    const link = compileOne(`${UI}export default function C() { return <Link to="ftp://x">o</Link> }`).diagnostics;
    expect(link.map((x) => [x.code, x.fix])).toEqual([["E1003", undefined]]);
    const img = compileOne(
      `${UI}export default function C() { return <Image src="data:image/png;base64,x" alt="x" /> }`,
    );
    expect(img.diagnostics.map((x) => x.code)).toEqual(["E1003"]);
    expect(img.diagnostics[0]?.fix).toContain('+export default function C() { return <Image alt="x" /> }');
  });
});
