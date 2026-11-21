import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

// Resume gives a claimed server element with regions an own `childNodes` without them (ADR-0155 D5); only
// `childNodes[i]` reads see it. Compiled output must reach a claimed element's children no other way.
// The nodes compiled output holds are its own `__k<kind><n>` variables; the app's code (`props.children()`) is not a read.
const OTHER_READS =
  /__k[a-z]+\d+\.(?:firstChild|lastChild|nextSibling|previousSibling|firstElementChild|lastElementChild|nextElementSibling|previousElementSibling|children|childElementCount)\b|__k[a-z]+\d+\.childNodes(?!\[\d+\])/;

/** The compiled code of one source, its lines from runtime-dom imports and templates dropped. */
const compiled = (file: string, source: string): string =>
  (compile([{ path: file, source }]).outputs[0]?.code ?? "")
    .split("\n")
    .filter((l) => !l.startsWith("import ") && !l.startsWith("const __kt"))
    .join("\n");

const ROOT = path.resolve(import.meta.dirname, "../../..");
const tsxUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "dist" ? [] : tsxUnder(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });

describe("compiled output reads a claimed element's children only through childNodes[i]", () => {
  it("every app component", () => {
    const files = tsxUnder(path.join(ROOT, "apps"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const code = compiled(path.basename(f), fs.readFileSync(f, "utf8"));
      expect({ file: path.relative(ROOT, f), read: OTHER_READS.exec(code)?.[0] ?? null }).toEqual({
        file: path.relative(ROOT, f),
        read: null,
      });
    }
  });

  const leaf = fc.constantFrom("text", "{n.get()}", "{props.children()}", "<b>x</b>", "<input value={v.get()} />");
  const tree = fc.letrec((tie) => ({
    node: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      leaf,
      fc
        .tuple(fc.constantFrom("div", "p", "section"), fc.array(tie("node"), { maxLength: 4 }))
        .map(([tag, kids]) => `<${tag}>${kids.join("")}</${tag}>`),
      fc.array(tie("node"), { maxLength: 3 }).map((kids) => `<If when={n.get() > 0}><div>${kids.join("")}</div></If>`),
      fc
        .array(tie("node"), { maxLength: 3 })
        .map((kids) => `<For each={xs.get()}>{(x) => <li>{x}${kids.join("")}</li>}</For>`),
      fc
        .array(tie("node"), { maxLength: 3 })
        .map((kids) => `<Boundary fallback={() => <p>e</p>}><span>${kids.join("")}</span></Boundary>`),
    ),
  }));

  it("property: any tree of elements, texts, slots and structural ops", () => {
    fc.assert(
      fc.property(fc.array(tree.node, { minLength: 1, maxLength: 4 }), (kids) => {
        const source = `import { signal } from "@keel/reactive";
import { Boundary, For, If } from "@keel/runtime-dom";
export default function C(props) { const n = signal(0); const v = signal(""); const xs = signal([1]);
return <main id="c.root" onClick={() => n.set(1)}>${kids.join("")}</main> }`;
        expect(OTHER_READS.exec(compiled("C.tsx", source))?.[0] ?? null).toBeNull();
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
