// @vitest-environment happy-dom
// The widgets as JSX tags: `test/fixtures/Shipping.tsx` type-checks against the Keel JSX types (`check`), and here it
// is compiled as app code and rendered.
import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import { render } from "@keel/testing";
import { afterAll, expect, test } from "vitest";
import { el, isRecord, shown, simCtx } from "../conformance/fixtures.ts";

const dir = path.join(import.meta.dirname, "fixtures");
const out = path.join(dir, "Shipping.compiled.ts");
afterAll(() => fs.rmSync(out, { force: true }));

test("JSX children, slot props returning JSX and a `close` callback render through the compiled tags", async () => {
  const source = fs.readFileSync(path.join(dir, "Shipping.tsx"), "utf8");
  const r = compile([{ path: "src/Shipping.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  const code = r.outputs.find((o) => o.path === "src/Shipping.tsx")?.code;
  expect(code).toBeDefined();
  fs.writeFileSync(out, code ?? "");
  const mod: unknown = await import(out);
  const Shipping = isRecord(mod) ? mod.default : undefined;
  if (typeof Shipping !== "function") throw new Error("no compiled component");
  const t = render(
    Object.assign((p: Record<string, never>) => Reflect.apply(Shipping, undefined, [p]), {
      Props: Reflect.get(Shipping, "Props"),
    }),
    {
      props: {},
      ctx: simCtx(),
    },
  );
  expect(t.find("ship.button").text).toBe("Shipping");
  expect(shown("ship.panel")).toBe(false);
  await t.fire("ship.button", { type: "click" });
  expect(t.find("ship.body").text).toBe("Ships in two days.");
  expect(shown("ship.panel")).toBe(true);
  await t.fire("dlg.trigger", { type: "click" });
  expect(el("dlg.dialog")?.hasAttribute("open")).toBe(true);
  await t.fire("dlg.ok", { type: "click" });
  expect(el("dlg.dialog")?.hasAttribute("open")).toBe(false);
  expect(t.find("tb.body.box").text).toBe("box");
  t.dispose();
});
