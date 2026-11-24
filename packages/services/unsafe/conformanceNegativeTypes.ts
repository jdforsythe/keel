// Type-only fixture for conformance/contract-client.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same calls untyped.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { service } from "@keel/services";
import { unsafe } from "./unsafe.ts";

export function conformanceNegativeTypes(): void {
  unsafe(
    "type-level negatives: each expected-error line asserts the service client rejects a misuse; checked by tsc, never run",
    () => {
      const Box = s.object({ title: s.string() });
      const c = contract("kitchen", {
        "kitchen.shell": { layout: true },
        "kitchen.home": { path: "/kitchen" },
        "kitchen.box": { method: "GET", path: "/api/recipes", output: Box },
        "kitchen.catalog": {
          method: "GET",
          path: "/api/catalog/:locale",
          params: s.object({ locale: s.string() }),
          query: s.object({ q: s.string() }),
          output: Box,
        },
      });
      const api = service({ contract: c });
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      // @ts-expect-error a page entry has no client method
      api.home;
      // @ts-expect-error a layout entry has no client method
      api.shell;
      // @ts-expect-error `catalog` declares params and query
      api.catalog({}, ctx);
      // @ts-expect-error `box` takes no body
      api.box({ body: { title: "x" } }, ctx);
      // @ts-expect-error `q` is a string
      api.catalog({ params: { locale: "en" }, query: { q: 5 } }, ctx);
    },
  );
}
