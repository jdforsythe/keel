// @vitest-environment happy-dom
// Spec: k.component, clause "A component's JSX children arrive as `props.children` and render inside the child's scope."
// Spec: k.component, clause "A base element given JSX text children renders that text."
// Real JSX compiled by @keel/compiler, real @keel/ui base elements, real harness (find(id) only). Seed: 1337.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import type { Scope } from "@keel/reactive";
import { owner } from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import type { TestComponent } from "@keel/testing";
import { render } from "@keel/testing";
import * as ui from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { home } from "./ui-fixtures.ts";

interface Probe {
  readonly log: string[];
  readonly scopes: Map<string, Scope | undefined>;
  readonly types: Map<string, string>;
}

const newProbe = (): Probe => ({ log: [], scopes: new Map(), types: new Map() });

/** Compile one source file (zero diagnostics), evaluate against real @keel/ui plus the probe, and wrap it as a harness component. */
function build(
  name: string,
  source: string,
  probe: Probe,
  extra: Readonly<Record<string, unknown>> = {},
): TestComponent<Record<string, never>> {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const mod = {
    mark(tag: string, value: string): string {
      probe.log.push(tag);
      probe.scopes.set(tag, owner());
      return value;
    },
    typeOf(tag: string, v: unknown): void {
      probe.types.set(tag, typeof v);
    },
  };
  const fn = evaluate(out.code, { "@keel/ui": ui, probe: mod, fx: extra });
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return Object.assign(
    (p: Record<string, never>, slots?: Slots, ctx?: Ctx): Node => {
      const node: unknown = fn(p, slots, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: s.object({}) },
  );
}

const IMPORTS = `import { Box, Button, Heading, Link, Text } from "@keel/ui"\nimport * as probe from "probe"\nimport * as fx from "fx"\n`;

describe("k.component: a base element given JSX text children renders that text", () => {
  it("Button, Text, Heading and Link given JSX text children render that text: text, and name for Button/Heading/Link", () => {
    const P = build(
      "BaseText",
      `${IMPORTS}export default function BaseText() { return <Box id="page"><Button id="b">Go</Button><Text id="t">hello</Text><Heading id="h" level={2}>Orders</Heading><Link id="l" to={fx.home}>Home</Link></Box> }\n`,
      newProbe(),
      { home },
    );
    const t = render(P, { props: {}, ctx: simCtx() });
    expect(t.find("b").text).toBe("Go");
    expect(t.find("b").name).toBe("Go");
    expect(t.find("t").text).toBe("hello");
    expect(t.find("h").text).toBe("Orders");
    expect(t.find("h").name).toBe("Orders");
    expect(t.find("l").text).toBe("Home");
    expect(t.find("l").name).toBe("Home");
    t.dispose();
  });

  it("property: any printable non-empty trimmed string given as JSX text children of Button and Text renders as that string", () => {
    // Seed 1337. Strings reach the compiled source through a string literal expression child, so JSX syntax characters are safe.
    const text = fc
      .string({ minLength: 1, maxLength: 24 })
      .map((x) => x.replace(/[^\x20-\x7e]/g, "x").trim())
      .filter((x) => x.length > 0);
    fc.assert(
      fc.property(fc.oneof(text, fc.constant("<script>alert(1)</script>")), (str) => {
        const lit = JSON.stringify(str);
        const P = build(
          "PropText",
          `${IMPORTS}export default function PropText() { return <Box id="page"><Button id="b">{${lit}}</Button><Text id="t">{${lit}}</Text></Box> }\n`,
          newProbe(),
        );
        const t = render(P, { props: {}, ctx: simCtx() });
        expect(t.find("b").text).toBe(str);
        expect(t.find("t").text).toBe(str);
        t.dispose();
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("nested JSX elements render their children: the outer element's text includes the inner element's text", () => {
    const P = build(
      "Nested",
      `${IMPORTS}export default function Nested() { return <Box id="outer"><Text id="inner">hi</Text></Box> }\n`,
      newProbe(),
    );
    const t = render(P, { props: {}, ctx: simCtx() });
    expect(t.find("inner").text).toBe("hi");
    expect(t.find("outer").text).toBe("hi");
    t.dispose();
  });
});

describe("k.component: JSX children arrive as props.children and render inside the child's scope", () => {
  const wrapSrc = (body: string) =>
    `${IMPORTS}function Wrap(props: { children: () => Node }) { probe.mark("child", ""); probe.typeOf("children", props.children); return ${body} }\nexport default function P() { probe.mark("parent", ""); return <Wrap><Text id="kid">{probe.mark("thunk", "kid text")}</Text></Wrap> }\n`;

  it("props.children is a thunk that runs after parent and child, inside the child's scope, and its content renders", () => {
    const probe = newProbe();
    const P = build("Wrapped", wrapSrc(`<Box id="wrap" children={props.children} />`), probe);
    const t = render(P, { props: {}, ctx: simCtx() });
    expect(probe.types.get("children")).toBe("function");
    expect(probe.log).toEqual(["parent", "child", "thunk"]);
    const child = probe.scopes.get("child");
    expect(child).toBeDefined();
    expect(probe.scopes.get("thunk")).toBe(child);
    expect(probe.scopes.get("thunk")).not.toBe(probe.scopes.get("parent"));
    expect(t.find("kid").text).toBe("kid text");
    expect(t.find("wrap").text).toBe("kid text");
    t.dispose();
  });

  it("if the child never renders props.children, the thunk never runs", () => {
    const probe = newProbe();
    const P = build("Ignoring", wrapSrc(`<Box id="wrap" />`), probe);
    const t = render(P, { props: {}, ctx: simCtx() });
    expect(probe.types.get("children")).toBe("function");
    expect(probe.log).toEqual(["parent", "child"]);
    expect(t.find("wrap").text).toBe("");
    t.dispose();
  });
});
