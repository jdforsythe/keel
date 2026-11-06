// @vitest-environment happy-dom
// Spec: k.component Conformance, "A component's JSX children arrive as `props.children` and render inside the child's scope; a base element given JSX text children renders that text". Seed: 1337.
// Real base elements from @keel/ui under the real harness.
import type { Scope } from "@keel/reactive";
import { owner } from "@keel/reactive";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Button, Checkbox, Heading, Text } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

describe("k.component: a base element given JSX text children renders that text", () => {
  it("Button, Text and Heading render their text children, visible through find(id)", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,19}$/), (label) => {
        const C = Object.assign(
          (): Node =>
            Box({
              id: "page",
              children: () =>
                Box({
                  children: [
                    Button({ id: "b", children: label }),
                    Text({ id: "t", children: label }),
                    Heading({ id: "h", level: 2, children: label }),
                  ],
                }),
            }),
          { Props: s.object({}) },
        );
        const t = render(C, { props: {}, ctx: simCtx() });
        for (const id of ["b", "t", "h"]) expect(t.find(id).text).toBe(label.trim());
        expect(t.find("b")).toMatchObject({ role: "button", name: label.trim() });
        expect(t.find("h").role).toBe("heading");
        t.dispose();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("nested base elements render their children in order", () => {
    const Page = Object.assign(
      (): Node => Box({ id: "page", children: [Text({ id: "x", children: "x" }), Text({ id: "y", children: "y" })] }),
      { Props: s.object({}) },
    );
    const t = render(Page, { props: {}, ctx: simCtx() });
    expect(t.find("page").text).toBe("xy");
    t.dispose();
  });

  it("a Checkbox keeps its label as the accessible name", () => {
    const C = Object.assign((): Node => Checkbox({ id: "c", label: "Agree" }), { Props: s.object({}) });
    const t = render(C, { props: {}, ctx: simCtx() });
    expect(t.find("c")).toMatchObject({ role: "checkbox", name: "Agree" });
    t.dispose();
  });
});

describe("k.component: JSX children arrive as a thunk and render inside the child's scope", () => {
  it("the thunk runs only when the child renders it, inside the child's scope, not the parent's", () => {
    const log: string[] = [];
    const seen: { child?: Scope | undefined; thunk?: Scope | undefined } = {};
    const Child = (props: { readonly children: () => Node }): Node => {
      log.push("child");
      seen.child = owner();
      return Box({ id: "child", children: props.children });
    };
    const Parent = Object.assign(
      (): Node => {
        const children = (): Node => {
          log.push("thunk");
          seen.thunk = owner();
          return Text({ id: "kid", children: "kid" });
        };
        log.push("parent");
        return Child({ children });
      },
      { Props: s.object({}) },
    );
    const t = render(Parent, { props: {}, ctx: simCtx() });
    expect(log).toEqual(["parent", "child", "thunk"]);
    expect(seen.thunk).toBeDefined();
    expect(seen.thunk).toBe(seen.child);
    expect(t.find("child").text).toBe("kid");
    t.dispose();
  });
});
