// @vitest-environment happy-dom
// Spec: k.resume, Conformance "For every route of a test app, the body of the document `createApp` serves, resumed with the app's compiled components by route id and its stores, returns no warning, keeps every server node, and a handler fired on a server element runs and updates the bindings it writes."
// Seed: 1337. Real compiled TSX, real createApp, real resume; no server HTML is written by hand.
import { afterEach, describe, expect, it } from "vitest";
import { click, componentsOf, elementsOf, expectKept, expectText, install, resumeBody, serve } from "./resume-app.ts";
import { ALL_LEVELS, ROUTES } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.resume: a served document resumes", () => {
  for (const route of ROUTES) {
    it(`For every route of a test app, the body of the document createApp serves resumes with no warning and keeps every server node (${route.path})`, async () => {
      const doc = await serve(ALL_LEVELS, route.path);
      expect(doc.status).toBe(200);
      install(doc);
      const before = elementsOf(document.body);
      const { warnings, console: logged } = resumeBody(componentsOf(ALL_LEVELS));
      expect(warnings).toEqual([]);
      expect(logged).toEqual([]);
      expectKept(before);
    });

    it(`a handler fired on a server element runs and updates the bindings it writes (${route.path})`, async () => {
      const doc = await serve(ALL_LEVELS, route.path);
      install(doc);
      const before = elementsOf(document.body);
      expect(resumeBody(componentsOf(ALL_LEVELS)).warnings).toEqual([]);
      for (const probe of route.probes) {
        expectText(probe.out, "0");
        await click(probe.click);
        expectText(probe.out, probe.after);
      }
      expectKept(before);
    });
  }
});
