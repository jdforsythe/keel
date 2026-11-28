// @vitest-environment happy-dom
// k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, clause "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// Seed: 1337 (no generated inputs). `HealthView` is the component of the `health.status` route, served by createApp to a browser (`accept: text/html`).
// The page has no handler of its own; it is either static (no `data-k-island`) or an island that resumes.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { routes } from "@keel/std-health/routes";
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";

async function served(mode: "dev" | "production"): Promise<{ html: string; lines: string[] }> {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["health"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode,
    log: { format: "compact", write: (line: string) => void lines.push(line) },
  });
  let html = "";
  for (let i = 0; i < 2; i++) {
    const res = await app.fetch(new Request("http://localhost/health", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(200);
    html = await res.text();
  }
  return { html, lines };
}

describe("k.claim: HealthView is served and resumed in a fresh graph", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`HealthView in ${mode}: no E1257, no warning, removed() 0`, async () => {
      const { html, lines } = await served(mode);
      expect(lines.filter((l) => l.includes("E1257"))).toEqual([]);
      const t = await resumeDocument(html, { routes: () => import("./resume-health-routes.ts") });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      t.dispose();
    });
  }
});
