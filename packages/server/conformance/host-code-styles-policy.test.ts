// @vitest-environment happy-dom
// Spec: k.host-code, Styles and policy "In production a `<style>` element or a `style` attribute that outside code adds does not apply; `dev` serves the policy report-only, so there it applies and is reported."
// Spec: k.host-code, Conformance "In Chromium under a production document's policy, a `<style>` element and a `style` attribute that `mount` adds change no computed style, and `node.style.color` set by `mount` does."
// Seed: 1337 (no generated inputs). The Chromium clause needs a real browser's computed style and is untestable under happy-dom: only the policy header that causes it is asserted here.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Host } from "@keel/ui";
import { describe, expect, it } from "vitest";

const ctx = createCtx({ mode: "sim", seed: 1337 });
const Input = s.object({ points: s.array(s.number()) });

const headersOf = async (mode: "dev" | "production") => {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.chart": {
        path: "/chart",
        component: () =>
          Host({
            id: "app.chart.host",
            role: "img",
            label: "Chart",
            input: Input,
            value: { points: [1] },
            code: () => Promise.reject(new Error("the server never loads host element code")),
          }),
      },
    }),
    ctx,
    mode,
  });
  const res = await app.fetch(new Request("http://localhost/chart", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return res.headers;
};

const styleSrc = (policy: string | null): string =>
  (policy ?? "")
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("style-src ")) ?? "";

describe("k.host-code: the policy over a host element document", () => {
  it("a production document with a `Host` enforces `style-src 'self'` with no `'unsafe-inline'`", async () => {
    const h = await headersOf("production");
    expect(styleSrc(h.get("content-security-policy"))).toBe("style-src 'self'");
    expect(h.get("content-security-policy-report-only")).toBeNull();
  });

  it("`dev` serves the policy report-only, so a style added by outside code applies and is reported", async () => {
    const h = await headersOf("dev");
    expect(h.get("content-security-policy")).toBeNull();
    expect(styleSrc(h.get("content-security-policy-report-only"))).toContain("'unsafe-inline'");
    expect(h.get("reporting-endpoints")).toBe('keel-csp="/__keel/csp"');
  });
});
