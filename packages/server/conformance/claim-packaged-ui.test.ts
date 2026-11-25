// @vitest-environment happy-dom
// k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, clause "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// Seed: 1337 (no generated inputs). The base elements of `@keel/ui`, one page each, served by createApp and resumed in a graph of their own.
// The other packages' components are in the conformance directories of the packages that own them.
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { ELEMENTS, MODULE_IDS, routes } from "./claim-packaged-routes.ts";
import { e1257Lines } from "./claim-support.ts";
import { appOf } from "./resume-graph-app.ts";

const FRESH = () => import("./claim-packaged-routes.ts");

async function served(path: string, mode: "dev" | "production") {
  const lines: string[] = [];
  const app = await appOf(routes, MODULE_IDS, { mode, log: { lines } });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return { html: await res.text(), lines };
}

const act: Record<string, (t: Awaited<ReturnType<typeof resumeDocument>>) => Promise<string | undefined>> = {
  Button: async (t) => {
    await t.fire("ue.button", { type: "click" });
    return "clicked";
  },
  Input: async (t) => {
    await t.fire("ue.input", { type: "input", value: "abc" });
    return "abc";
  },
  TextArea: async (t) => {
    await t.fire("ue.textarea", { type: "input", value: "some notes" });
    return "some notes";
  },
  Select: async (t) => {
    await t.fire("ue.select", { type: "input", value: "b" });
    await t.fire("ue.select", { type: "change" });
    return "b";
  },
  Checkbox: async (t) => {
    await t.fire("ue.checkbox", { type: "click" });
    return "true";
  },
};

describe("k.claim: each base element of @keel/ui resumes in a fresh graph", () => {
  ELEMENTS.forEach((e, i) => {
    it(`${e.name}: no warning, no E1257, removed() 0, and its handler works`, async () => {
      const { html, lines } = await served(`/ue${i}`, "production");
      expect(e1257Lines(lines)).toEqual([]);
      const t = await resumeDocument(html, { routes: FRESH });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      const expected = await act[e.name]?.(t);
      if (expected !== undefined) expect(t.find(`ue${i}.seen`).text).toBe(expected);
      await t.fire(`ue${i}.inc`, { type: "click" });
      expect(t.find(`ue${i}.out`).text).toBe("1");
      t.dispose();
    });
  });

  it("base elements log no E1257 and resume with removed() 0 in dev as in production", async () => {
    const { html, lines } = await served("/ue6", "dev");
    expect(e1257Lines(lines)).toEqual([]);
    const t = await resumeDocument(html, { routes: FRESH });
    expect(t.removed()).toBe(0);
    t.dispose();
  });
});
