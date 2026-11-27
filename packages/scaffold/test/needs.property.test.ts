// Seed 1337. k.scaffold-needs: a library refuses an app's generators whatever their input; `route --api` with no
// `node` deployable is E1353 naming E1511; `transaction` without its store and `shell` without a `client` deployable
// name the line that makes what is missing; yarn's `.gitignore` (k.create-manager).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Op, scaffold } from "../src/index.ts";
import { gitignoreOf } from "../src/internal/gitignoreOf.ts";
import { RUNS, SEED, apply, lower } from "./helpers.ts";

const LIBRARY_MESSAGE = "a library has no modules; write a component in src/ and export it from src/index.ts";
const APP_OPS: readonly Op[] = ["module", "route", "component", "store", "transaction", "service", "shell"];
const library = (): Map<string, string> => apply("library", { name: "@acme/charts", version: "0.0.0" }, new Map());
const project = (adapter: "client" | "node" | "static"): Map<string, string> =>
  apply("project", { name: "shop", adapter }, new Map());
/** The library's own folder: `library` writes under `<base>/`, read as the project root. */
const inside = (files: ReadonlyMap<string, string>): Map<string, string> =>
  new Map([...files].filter(([p]) => p.startsWith("charts/")).map(([p, v]) => [p.slice("charts/".length), v]));

describe("k.scaffold-needs", () => {
  it("in a library each app generator is one E1052 saying what a library holds, whatever its input", () => {
    const files = inside(library());
    fc.assert(
      fc.property(
        fc.constantFrom(...APP_OPS),
        fc.dictionary(fc.constantFrom("id", "shell", "base", "path", "api"), fc.oneof(fc.string(), lower)),
        (op, input) => {
          const r = scaffold(op, input, files);
          expect(r.ok).toBe(false);
          if (r.ok) return;
          expect(r.error.data.code).toBe("E1052");
          expect(r.error.data.message).toBe(LIBRARY_MESSAGE);
          expect(r.error.data.see).toBe("k.library-pack");
          expect(r.error.data.missing).toBeUndefined();
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("an API route in a module a client or static deployable lists is E1353 naming E1511; on node it is written", () => {
    for (const adapter of ["client", "static"] as const)
      for (const method of [undefined, "POST"]) {
        const r = scaffold("route", { id: "app.ping", api: true, ...(method ? { method } : {}) }, project(adapter));
        expect(r.ok).toBe(false);
        if (r.ok) continue;
        expect(r.error.data.code).toBe("E1353");
        expect(r.error.data.message).toContain("an API route needs a node deployable");
        expect(r.error.data.cause?.code).toBe("E1511");
        expect(r.error.data.message.length).toBeLessThan(90);
      }
    expect(scaffold("route", { id: "app.ping", api: true }, project("node")).ok).toBe(true);
  });

  it("a transaction whose store is missing prints the store line; one whose module is missing names no line", () => {
    const files = project("client");
    const r = scaffold("transaction", { id: "app.cart.addItem" }, files);
    expect(r.ok ? "" : r.error.data.message).toBe("transaction needs a store first: keel scaffold store app.cart");
    const s = scaffold("transaction", { id: "orders.cart.addItem" }, files);
    expect(s.ok ? "" : s.error.data.message).toBe("orders is not a module of this project");
    const withStore = apply("store", { id: "app.cart" }, files);
    expect(scaffold("transaction", { id: "app.cart.addItem" }, withStore).ok).toBe(true);
  });

  it("a shell with no client deployable is E1359 naming the place line, which then lets it through", () => {
    for (const adapter of ["static", "node"] as const) {
      const files = project(adapter);
      const r = scaffold("shell", { shell: "tauri", id: "com.acme.shop" }, files);
      expect(r.ok ? "" : r.error.data.code).toBe("E1359");
      const message = r.ok ? "" : r.error.data.message;
      expect(message).toBe("no client deployable; first: keel codemod place app --to app --adapter client");
      const placed = apply("place", { module: "app", to: "app", adapter: "client" }, files);
      expect(scaffold("shell", { shell: "tauri", id: "com.acme.shop" }, placed).ok).toBe(true);
    }
  });

  it("yarn's .gitignore adds yarn's list after the shared one; other managers get the shared one alone", () => {
    const shared = gitignoreOf(undefined);
    expect(gitignoreOf("pnpm@11.17.0")).toBe(shared);
    expect(gitignoreOf("yarn@4.5.0")).toBe(
      `${shared}.pnp.*\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/sdks\n!.yarn/versions\n`,
    );
    const app = apply("project", { name: "shop", version: "0.0.0", packageManager: "yarn@4.5.0" }, new Map());
    expect(app.get("shop/.gitignore") ?? app.get(".gitignore")).toBe(gitignoreOf("yarn@4.5.0"));
  });
});
