// @vitest-environment happy-dom
// Spec: k.schema, Conformance "`piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object, then `*` for its undeclared keys when it is open; a control bound (k.forms) to a declared object under it carries its nearest mark's class as `data-k-pii`." (rfc:0154)
// Seed: 1337 (no random input).
// Set up as privacy-input-mask.test.ts does: a `form` over the schema, controls bound with `field(path).bind(el)`, mounted with
// runtime-dom under a sim ctx; `data-k-pii` is read from the element. The schema is
// `address: s.object({ street, geo: s.object({ lat }).pii('special') }).pii('location')`.
import { createCtx } from "@keel/ctx";
import { form } from "@keel/forms";
import { createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { type ObjectSchema, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

type DomNode = globalThis.Node;

const schema: ObjectSchema<Record<string, unknown>> = s.object(
  Object.fromEntries([
    ["address", s.object({ street: s.string(), geo: s.object({ lat: s.number() }).pii("special") }).pii("location")],
  ]),
);

const makeForm = () => form(schema);
type Form = ReturnType<typeof makeForm>;

/** Runs `fn` inside a mounted component, where `form` may create its signals; `fn` gets the form and its bound container. */
const inComponent = async <T>(fn: (f: Form, root: Element) => T): Promise<T> => {
  const out: T[] = [];
  const plContract = contract("pl", { "pl.show": { path: "/pl" } });
  const routes = manifest(plContract, {
    "pl.show": {
      component(): DomNode {
        const main = document.createElement("main");
        out.push(fn(makeForm(), main));
        return main;
      },
    },
  });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const router = createRouter(routes, { ctx, history: memoryHistory("/pl") });
  const root = document.createElement("div");
  document.body.appendChild(root);
  const unmount = mount(router.App, root, { ctx });
  try {
    await settle();
    const [value] = out;
    if (out.length === 0 || value === undefined) throw new Error("the component did not render");
    return value;
  } finally {
    unmount();
    root.remove();
  }
};

/** Binds a plain `input` per path and returns the `data-k-pii` of each, `null` when the attribute is absent. */
const piiOf = (paths: readonly string[]): Promise<(string | null)[]> =>
  inComponent((f, main) => {
    const els = paths.map((p, i) => {
      const el = document.createElement("input");
      el.setAttribute("data-k", `pl.f${i}`);
      el.id = `pl.f${i}`;
      f.field(p).bind(el);
      main.append(el);
      return el;
    });
    return els.map((el) => el.getAttribute("data-k-pii"));
  });

describe("k.schema path lookups follow declared fields (data-k-pii)", () => {
  it("an input bound with `field('address.geo')` has `data-k-pii=\"special\"`: a declared non-leaf keeps its own mark, not `address.*`'s `location`", async () => {
    expect(await piiOf(["address.geo"])).toEqual(["special"]);
  });

  it("`field('address.street')` gives `data-k-pii=\"location\"`: a declared leaf takes the nearest mark's class", async () => {
    expect(await piiOf(["address.street"])).toEqual(["location"]);
  });

  it("a declared leaf under a marked declared object takes that object's class: `address.geo.lat` is `special`", async () => {
    expect(await piiOf(["address.geo.lat"])).toEqual(["special"]);
  });

  it("`field('address.floor')` throws E1902: a form binds declared paths only", async () => {
    const thrown = await inComponent((f) => {
      const loose: (path: string) => unknown = f.field;
      const messages: string[] = [];
      for (const p of ["address.floor", "address.floor.n"]) {
        try {
          loose(p);
        } catch (e) {
          messages.push(e instanceof Error ? e.message : String(e));
        }
      }
      return messages;
    });
    expect(thrown).toHaveLength(2);
    for (const m of thrown) expect(m).toMatch(/^E1902 /);
  });

  // Spec: k.schema, Derivations "`piiPaths(schema)` ... the class its nearest mark's" (rfc:0154 D4: the union rule is stated in the RFC and ADR-0176, the section has no room for it).
  it("a field several union variants declare takes a marked variant's class, though the first is unmarked: `field('u.name')` and `field('u.k')` are `name`", async () => {
    const union: ObjectSchema<Record<string, unknown>> = s.object(
      Object.fromEntries([
        [
          "u",
          s.union("k", [
            s.object({ k: s.literal("a"), name: s.string() }),
            s.object({ k: s.literal("b"), name: s.string() }).pii("name"),
          ]),
        ],
      ]),
    );
    const got = await inComponent((_f, main) => {
      const f = form(union);
      return ["u.name", "u.k"].map((p, i) => {
        const el = document.createElement("input");
        el.setAttribute("data-k", `pl.u${i}`);
        el.id = `pl.u${i}`;
        f.field(p).bind(el);
        main.append(el);
        return el.getAttribute("data-k-pii");
      });
    });
    expect(got).toEqual(["name", "name"]);
  });
});
