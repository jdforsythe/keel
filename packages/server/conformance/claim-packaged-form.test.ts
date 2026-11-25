// @vitest-environment happy-dom
// k.claim, Packaged components "Each component `@keel/ui`, `@keel/router`, `@keel/std-headless`, `@keel/std-tables` and `@keel/std-health` export, served by `createApp` with its props and slots and resumed by `resumeDocument` in a module graph of its own (k.testing), resumes with no warning, no E1257 and no element removed, and its handlers work."
// Spec: k.claim, clause "`DataTable` (client and server sources: sort link, Next, select), each std-headless widget (an option chosen, a menu opened, a tab switched, a dialog opened and closed, a disclosure toggled, a toast dismissed), `TableSearch`, `Form`, base elements and `HealthView` resume in a fresh graph with `removed()` 0, no warning, no E1257, and their handlers work."
// Seed: 1337 (no generated inputs). `Form` with JSX children, served by createApp and resumed in a graph of its own.
// A resumed island mounts no router, so its `Form` is a native form: its children's handlers run on the client and its submit runs the
// action through the server, which this test does with the form's own method, action and fields.
import { resumeDocument } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { MODULE_IDS, received, routes } from "./claim-packaged-routes.ts";
import { e1257Lines } from "./claim-support.ts";
import { appOf } from "./resume-graph-app.ts";

const FRESH = () => import("./claim-packaged-routes.ts");

describe("k.claim: Form with JSX children resumes in a fresh graph", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`no warning, no E1257, removed() 0, a child's handler works and the form submits to its action in ${mode}`, async () => {
      const lines: string[] = [];
      const app = await appOf(routes, MODULE_IDS, { mode, log: { lines } });
      const res = await app.fetch(new Request("http://localhost/fm", { headers: { accept: "text/html" } }));
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(e1257Lines(lines)).toEqual([]);

      const t = await resumeDocument(html, { routes: FRESH });
      expect(t.removed()).toBe(0);
      expect(t.detached()).toBe(0);
      await t.fire("fm.inc", { type: "click" });
      expect(t.find("fm.out").text).toBe("1");
      expect(t.find("fm.note").role).toBe("textbox");
      await t.fire("fm.note", { type: "input", value: "hello" });
      t.dispose();

      const before = received.length;
      const post = await app.fetch(
        new Request("http://localhost/fm/save", {
          method: "POST",
          headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded" },
          body: "note=hello",
        }),
      );
      expect(post.status).toBeLessThan(400);
      expect(received.length).toBe(before + 1);
      expect(received.at(-1)).toBe("hello");
    });
  }
});
