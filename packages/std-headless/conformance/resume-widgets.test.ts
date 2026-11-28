// @vitest-environment happy-dom
// k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, clause "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// Seed: 1337 (no generated inputs). Each widget is the only content of an island page, served by createApp in dev and production
// and resumed in a module graph of its own; `resumeDocument` rejects with E1720 on a resume warning.
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { type Served, e1257, serve } from "./resume-support.ts";
import { WIDGETS, routes } from "./resume-widget-routes.ts";

// One contract, so one module: every widget page belongs to `w`.
const MODULES = ["w"];
const FRESH = () => import("./resume-widget-routes.ts");

type Handle = Awaited<ReturnType<typeof resumeDocument>>;

const flows: Record<string, (t: Handle) => Promise<void>> = {
  Listbox: async (t) => {
    await t.fire("lb.list", { type: "focus" });
    await t.fire("lb.list", { type: "keydown", key: "ArrowDown" });
    await t.fire("lb.list", { type: "keydown", key: "Enter" });
    expect(t.find("lb.calls").text).toBe("1");
    expect(t.find("lb.last").text).toBe("banana");
    expect(t.find("lb.option.banana").state.selected).toBe(true);
  },
  Combobox: async (t) => {
    await t.fire("cb.input", { type: "focus" });
    await t.fire("cb.input", { type: "keydown", key: "ArrowDown" });
    expect(t.find("cb.input").state.expanded).toBe(true);
    await t.fire("cb.input", { type: "keydown", key: "Enter" });
    expect(t.find("cb.calls").text).toBe("1");
    expect(t.find("cb.last").text).toBe("apple");
  },
  Menu: async (t) => {
    await t.fire("mn.trigger", { type: "keydown", key: "Enter" });
    expect(t.find("mn.trigger").state.expanded).toBe(true);
    await t.fire("mn.item.remove", { type: "click" });
    expect(t.find("mn.calls").text).toBe("1");
    expect(t.find("mn.last").text).toBe("remove");
    expect(t.find("mn.trigger").state.expanded).toBe(false);
  },
  Tabs: async (t) => {
    await t.fire("tb.tab.one", { type: "focus" });
    await t.fire("tb.tab.one", { type: "keydown", key: "ArrowRight" });
    expect(t.find("tb.calls").text).toBe("1");
    expect(t.find("tb.last").text).toBe("two");
    expect(t.find("tb.tab.two").state.selected).toBe(true);
    expect(t.find("tb.body.two").text).toBe("Body two");
  },
  Dialog: async (t) => {
    await t.fire("dg.trigger", { type: "click" });
    expect(document.getElementById("dg.dialog")?.hasAttribute("open")).toBe(true);
    await t.fire("dg.dialog", { type: "keydown", key: "Escape" });
    expect(document.getElementById("dg.dialog")?.hasAttribute("open")).toBe(false);
    expect(t.find("dg.trigger").state.focused).toBe(true);
    await t.fire("dg.trigger", { type: "click" });
    await t.fire("dg.ok", { type: "click" });
    expect(t.find("dg.calls").text).toBe("1");
    expect(document.getElementById("dg.dialog")?.hasAttribute("open")).toBe(false);
  },
  Disclosure: async (t) => {
    expect(t.find("dc.button").state.expanded).toBe(false);
    await t.fire("dc.button", { type: "click" });
    expect(t.find("dc.button").state.expanded).toBe(true);
    expect(document.getElementById("dc.panel")?.hidden).toBe(false);
    await t.fire("dc.button", { type: "click" });
    expect(t.find("dc.button").state.expanded).toBe(false);
    expect(document.getElementById("dc.panel")?.hidden).toBe(true);
  },
  Toaster: async (t) => {
    await t.fire("ts.dismiss.t1", { type: "click" });
    expect(t.find("ts.calls").text).toBe("1");
    expect(t.find("ts.last").text).toBe("t1");
  },
};

describe("k.claim: each std-headless widget is served and resumed in a fresh graph", () => {
  for (const w of WIDGETS) {
    it(`${w.name}: no warning, no E1257 in dev and production, removed() 0, and its handlers work`, async () => {
      const served: Served[] = [];
      for (const mode of ["dev", "production"] as const) {
        served.push(await serve(routes, MODULES, `/${w.key}`, { mode, requests: 2 }));
      }
      for (const s of served) {
        expect(s.status).toBe(200);
        expect(e1257(s)).toEqual([]);
      }
      const html = served[1]?.text ?? "";
      const t = await resumeDocument(html, { routes: FRESH });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      const flow = flows[w.name];
      if (flow === undefined) throw new Error(`fixture: no flow for ${w.name}`);
      await flow(t);
      t.dispose();
    });
  }
});
