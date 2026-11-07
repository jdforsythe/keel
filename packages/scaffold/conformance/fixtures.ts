import { plan, scaffold } from "@keel/scaffold";
// Shared harness for k.scaffold conformance. Not a test file.
// ASSUMED API (one line): every operation is a pure function
//   scaffold(op, input, files: Map<string,string>) => Result<{ files, created, changed }, KeelError>
//   plan(op, input, files) => same Result shape, computed without applying. Inputs: project {name}, module {id},
//   route {id, path}, component {id:"orders/OrderCard"}, store {id:"orders.cart"}, rename {kind, from, to},
//   move {name, to}, add-field {schema, field, type, default?}. Error codes are found as substrings of the JSON error.
// Seed 1337 for all fast-check runs. Generated names carry a "zq"/"Zq" prefix so they cannot collide with template words.
import fc from "fast-check";

export const SEED = 1337;
export const RUNS = 25;
export type Files = Map<string, string>;
export type Op = Parameters<typeof scaffold>[0];
export type Input = Record<string, unknown>;

export const lowerName = fc.stringMatching(/^[a-z]{3,8}$/).map((s) => `zq${s}`);
export const pascalName = fc.stringMatching(/^[a-z]{3,8}$/).map((s) => `Zq${s}`);
export const distinctPair = <T extends string>(a: fc.Arbitrary<T>) =>
  fc.tuple(a, a).filter(([x, y]) => !x.includes(y) && !y.includes(x));

export function apply(op: Op, input: Input, files: Files) {
  const r = scaffold(op, input, files);
  if (!r.ok) throw new Error(`${String(op)} failed: ${JSON.stringify(r.error)}`);
  return r.value;
}
export function planOf(op: Op, input: Input, files: Files) {
  return plan(op, input, files);
}
export function errText(r: { ok: boolean; error?: unknown }): string {
  return r.ok ? "" : JSON.stringify(r.error);
}
export function snap(files: Files): string {
  return JSON.stringify([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
export function find(files: Files, re: RegExp): string[] {
  return [...files.keys()].filter((k) => re.test(k));
}
export function only(files: Files, re: RegExp): string {
  const hits = find(files, re);
  const first = hits[0];
  if (hits.length !== 1 || first === undefined)
    throw new Error(`expected exactly one ${re}, got ${JSON.stringify(hits)}`);
  return first;
}
export function read(files: Files, path: string): string {
  const v = files.get(path);
  if (v === undefined) throw new Error(`missing ${path}`);
  return v;
}
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const word = (s: string) => new RegExp(`(?<![A-Za-z0-9_])${esc(s)}(?![A-Za-z0-9_])`);
export const isGenerated = (p: string) =>
  p.startsWith(".keel/") || p === "turbo.json" || p.startsWith(".github/workflows/") || /Dockerfile|compose/.test(p);

export function rel(from: string, to: string): string {
  const f = from.split("/").slice(0, -1);
  const t = to.split("/");
  while (f.length > 0 && t.length > 1 && f[0] === t[0]) {
    f.shift();
    t.shift();
  }
  const up = f.map(() => "..");
  const r = [...up, ...t].join("/");
  return r.startsWith(".") ? r : `./${r}`;
}

export function fresh(): Files {
  let files: Files = new Map();
  files = apply("project", { name: "shop" }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  files = apply("module", { id: "catalog" }, files).files;
  return files;
}

/** fresh + component orders/OrderCard + store orders.cart + route orders.show + a hand-written page that references all three. */
export function withOrders(): Files {
  let files = fresh();
  files = apply("component", { id: "orders/OrderCard" }, files).files;
  files = apply("store", { id: "orders.cart" }, files).files;
  files = apply("route", { id: "orders.show", path: "/orders/:id" }, files).files;
  const card = only(files, /(^|\/)OrderCard\.tsx$/);
  const store = only(files, /(^|\/)cart\.store\.ts$/);
  const page = "modules/orders/OrdersPage.tsx";
  files.set(
    page,
    [
      `import OrderCard from '${rel(page, card)}'`,
      `import { cart } from '${rel(page, store)}'`,
      `import { routes } from './routes.ts'`,
      "export default function OrdersPage() {",
      "  const uses = [cart]",
      `  return { uses, link: routes.href('orders.show', { id: '1' }), card: OrderCard, id: 'OrderCard-root' }`,
      "}",
      "",
    ].join("\n"),
  );
  return files;
}

export function withSchema(constructors: boolean): Files {
  const files = fresh();
  files.set(
    "modules/orders/Order.schema.ts",
    `import { s } from '@keel/schema'\nexport const Order = s.object({ id: s.id('Order'), total: s.int() })\n`,
  );
  if (constructors) {
    files.set(
      "modules/orders/OrderForm.tsx",
      `import { form } from '@keel/forms'\nimport { Order } from './Order.schema.ts'\nexport default function OrderForm() {\n  return form(Order, { initial: { id: 'o1', total: 0 } })\n}\n`,
    );
    files.set(
      "modules/orders/Order.fixture.ts",
      `import type { Order } from './Order.schema.ts'\nexport const fixture: typeof Order.infer = { id: 'o1', total: 0 }\n`,
    );
  }
  return files;
}

export function scaffoldRaw(op: Op, input: Input, files: Files) {
  return scaffold(op, input, files);
}

/** fresh() + store orders.cart (the precondition of `transaction orders.cart.<name>`). */
export function withStoreCart(): Files {
  return apply("store", { id: "orders.cart" }, fresh()).files;
}

export const GENERATED_HEADER = "// Generated from OpenAPI by `keel scaffold service` (k.services); do not edit.";
/**
 * Sources `@keel/services/openapi` would generate for one GET endpoint of module `orders`, per the k.services spec
 * paths (rfc:0039): `OrdersApi.schema.ts` exporting `OrdersApi`, and `api.ts` importing it.
 */
export const ORDERS_API_SCHEMA = [
  GENERATED_HEADER,
  `import { s } from "@keel/schema";`,
  `import { endpoints } from "@keel/services";`,
  "",
  "export const OrdersApi = endpoints({",
  "  getOrder: {",
  `    method: "GET",`,
  `    path: "/orders/:id",`,
  "    params: s.object({ id: s.string() }),",
  "    output: s.object({ id: s.string(), total: s.int() }),",
  "  },",
  "});",
  "",
].join("\n");
export const ORDERS_API_SERVICE = [
  GENERATED_HEADER,
  `import { service } from "@keel/services";`,
  `import { OrdersApi } from "./OrdersApi.schema.ts";`,
  "",
  `export const api = service({ base: "https://api.example.com", schema: OrdersApi });`,
  "",
].join("\n");
export const SERVICE_INPUT = { id: "orders", schema: ORDERS_API_SCHEMA, service: ORDERS_API_SERVICE };
/** `<Id>Api`: the declaration name k.services gives module `id` (`orders` -> `OrdersApi`). */
export const apiName = (id: string): string => `${id.charAt(0).toUpperCase()}${id.slice(1)}Api`;
/** The same two sources generated for module `id`: `<Id>Api.schema.ts` exporting `<Id>Api`, and `api.ts`. */
export function serviceInput(id: string): { id: string; schema: string; service: string } {
  const n = apiName(id);
  return {
    id,
    schema: ORDERS_API_SCHEMA.replaceAll("OrdersApi", n),
    service: ORDERS_API_SERVICE.replaceAll("OrdersApi", n),
  };
}
/** An OpenAPI 3 document with the one operation of ORDERS_API_SCHEMA, for `keel scaffold service --openapi`. */
export const ORDERS_OPENAPI = JSON.stringify(
  {
    openapi: "3.0.3",
    info: { title: "orders", version: "1" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/orders/{id}": {
        get: {
          operationId: "getOrder",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id", "total"],
                    properties: { id: { type: "string" }, total: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  null,
  2,
);
/** fresh() + `openapi.json` (ORDERS_OPENAPI) at the project root. */
export function withOpenApi(): Files {
  const f = fresh();
  f.set("openapi.json", `${ORDERS_OPENAPI}\n`);
  return f;
}
