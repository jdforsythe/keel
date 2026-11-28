// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// `conformance/contract-client.test.ts`, which makes the same call untyped.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { service } from "@keel/services";

export function conformanceNegativeTypes(): void {
  // type-level negatives: each expected-error line asserts the service client rejects a misuse
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
}
