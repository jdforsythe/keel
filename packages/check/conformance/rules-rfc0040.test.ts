// Seed 1337
// k.router, Rules "E1501 string path where an `Href` is required" (the `navigate` half: any parameter typed `Href`).
// k.testing, Rules "E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`)" (destructured).
// RFC 0040 (backlog 0109). Links use a contract's `href(id)` (rfc:0157); the contract is declared here, as a value of the type its `href` has.
import { fileURLToPath } from "node:url";
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const ROUTES = "import type { Href } from '@keel/router'\ndeclare const orders: { href(id: 'orders.list'): Href }\n";

/** This package, whose node_modules resolve `@keel/router` (a devDependency) for the type pass. */
const APP = fileURLToPath(new URL("../", import.meta.url));

const codes = (path: string, source: string, types = true): string[] =>
  check([{ path, source }], types ? { root: APP } : { types: false }).diagnostics.map((d) => d.code);

test("E1501: a string path passed to a navigate function typed (h: Href) => void is E1501; a contract's href() is clean", () => {
  const bad = `${ROUTES}export const go = (nav: (h: Href) => void): void => nav('/orders')\n`;
  const clean = `${ROUTES}export const go = (nav: (h: Href) => void): void => nav(orders.href('orders.list'))\n`;
  expect(codes("src/go.ts", bad)).toEqual(["E1501"]);
  expect(codes("src/go.ts", clean)).not.toContain("E1501");
});

test("E1701: a DOM query destructured from render(...) in a test is reported; t.find(id) is not", () => {
  fc.assert(
    fc.property(fc.constantFrom("container", "getByRole", "queryByText", "querySelector"), (name) => {
      const source = `import { render } from '@keel/testing'\ndeclare const C: never\nconst { ${name} } = render(C, { props: {} })\nvoid ${name}\n`;
      expect(codes("modules/orders/x.test.ts", source, false)).toContain("E1701");
    }),
    { seed: SEED, numRuns: 8 },
  );
  const clean =
    "import { render } from '@keel/testing'\ndeclare const C: never\nconst t = render(C, { props: {} })\nvoid t.find('orders.total')\n";
  expect(codes("modules/orders/x.test.ts", clean, false)).not.toContain("E1701");
});
