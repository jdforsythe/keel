// Spec: k.scaffold, Generators "`service`: a client of an API no app module serves (k.services): `modules/<id>/<Name>Api.schema.ts` and `api.server.ts`, with `@keel/services` in `package.json` (k.scaffold-service)."
// Spec: k.scaffold, Turbo emission "Generated files are read-only (E1005)."
// RFC 0036, RFC 0039: `service { id: "<module>", schema, service }` places the two sources `@keel/services/openapi`
// generates at modules/<module>/<Module>Api.schema.ts (filename equals its one export `<Module>Api`, k.check E1752) and
// modules/<module>/api.server.ts. A later operation that would change or delete a file whose
// first line is a generated header (`// Generated`, `// _generated`; `# _generated` is the YAML form, CI only) is refused
// with E1005, nothing written.
// seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  GENERATED_HEADER,
  ORDERS_API_SCHEMA,
  ORDERS_API_SERVICE,
  RUNS,
  SEED,
  SERVICE_INPUT,
  apiName,
  apply,
  dryRun,
  errText,
  fresh,
  lowerName,
  read,
  scaffoldRaw,
  serviceInput,
  snap,
} from "./fixtures.ts";
import { freshNode, withModuleNode } from "./service-base-support.ts";

// The default project is `client`: `service` there needs a `reason` (E1358). These cases hold in the `node` project.
const withModule = withModuleNode;
const input = serviceInput;

describe("scaffold service", () => {
  it("places the schema source and the service source verbatim at modules/<module>/<Module>Api.schema.ts and api.server.ts", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const before = withModule(id);
        const inp = input(id);
        const out = apply("service", inp, before);
        const schemaPath = `modules/${id}/${apiName(id)}.schema.ts`;
        expect(out.created).toEqual([schemaPath, `modules/${id}/api.server.ts`]);
        expect(out.removed).toEqual([]);
        expect(read(out.files, schemaPath)).toBe(inp.schema);
        expect(read(out.files, `modules/${id}/api.server.ts`)).toBe(inp.service);
        for (const [p, c] of before) if (!out.changed.includes(p)) expect(out.files.get(p), p).toBe(c);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("each placed file's name equals its one export: OrdersApi.schema.ts exports OrdersApi, api.server.ts exports api", () => {
    const out = apply("service", SERVICE_INPUT, freshNode()).files;
    for (const [p, name] of [
      ["modules/orders/OrdersApi.schema.ts", "OrdersApi"],
      ["modules/orders/api.server.ts", "api"],
    ] as const)
      expect(
        [...read(out, p).matchAll(/^export const (\w+)/gm)].map((m) => m[1]),
        p,
      ).toEqual([name]);
  });
  it("both placed sources start with the generated header", () => {
    const out = apply("service", SERVICE_INPUT, freshNode()).files;
    for (const p of ["modules/orders/OrdersApi.schema.ts", "modules/orders/api.server.ts"])
      expect(read(out, p).split("\n")[0], p).toBe(GENERATED_HEADER);
  });
  it("service --dry-run (scaffold, not written) yields exactly the edit set the following apply writes", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const files = withModule(id);
        const before = snap(files);
        const p = dryRun("service", input(id), files);
        expect(snap(files)).toBe(before);
        expect(p.ok).toBe(true);
        const a = apply("service", input(id), files);
        if (p.ok) {
          expect(p.value.created).toEqual(a.created);
          expect(p.value.changed).toEqual(a.changed);
          expect(p.value.removed).toEqual(a.removed);
          expect(snap(p.value.files)).toBe(snap(a.files));
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("service rules", () => {
  it("E1052: a service for an unknown module is refused and writes nothing", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const f = fresh();
        const before = snap(f);
        expect(errText(scaffoldRaw("service", input(`${id}x`), f))).toContain("E1052");
        expect(snap(f)).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("E1351: running service twice reports E1351 the second time and writes nothing", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const once = apply("service", input(id), withModule(id)).files;
        const before = snap(once);
        const second = scaffoldRaw("service", input(id), once);
        expect(second.ok).toBe(false);
        expect(errText(second)).toContain("E1351");
        expect(snap(once)).toBe(before);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("E1351: an existing handwritten api.server.ts or OrdersApi.schema.ts blocks the service and writes nothing", () => {
    for (const existing of ["modules/orders/api.server.ts", "modules/orders/OrdersApi.schema.ts"]) {
      const f = freshNode();
      f.set(existing, "export const handwritten = 1;\n");
      const before = snap(f);
      expect(errText(scaffoldRaw("service", SERVICE_INPUT, f)), existing).toContain("E1351");
      expect(snap(f), existing).toBe(before);
    }
  });
});

describe("generated schemas are read-only (E1005)", () => {
  const ORDER = "export const Order = s.object({ id: s.string(), total: s.int() });";
  const withGenerated = (header: string) => {
    const f = fresh();
    f.set("modules/orders/Order.schema.ts", `${header}\nimport { s } from "@keel/schema";\n${ORDER}\n`);
    f.set(
      "modules/orders/OrderForm.tsx",
      `import { form } from "@keel/forms";\nimport { Order } from "./Order.schema.ts";\nexport default function OrderForm() {\n  return form(Order, { initial: { id: "o1", total: 0 } });\n}\n`,
    );
    return f;
  };
  const refuses = (op: Parameters<typeof apply>[0], inp: Record<string, unknown>, f: ReturnType<typeof fresh>) => {
    const before = snap(f);
    const r = scaffoldRaw(op, inp, f);
    expect(r.ok).toBe(false);
    expect(errText(r)).toContain("E1005");
    expect(snap(f)).toBe(before);
  };

  it("add-field to a schema in a placed OrdersApi.schema.ts is refused with E1005 and writes nothing", () => {
    const schema = ORDERS_API_SCHEMA.replace("export const OrdersApi", `${ORDER}\nexport const OrdersApi`);
    const f = apply("service", { id: "orders", schema, service: ORDERS_API_SERVICE }, freshNode()).files;
    refuses("add-field", { schema: "Order", field: "note", type: "string.optional" }, f);
  });
  it("rename of a schema declared in a placed OrdersApi.schema.ts is refused with E1005 and writes nothing", () => {
    const schema = ORDERS_API_SCHEMA.replace("export const OrdersApi", `${ORDER}\nexport const OrdersApi`);
    const f = apply("service", { id: "orders", schema, service: ORDERS_API_SERVICE }, freshNode()).files;
    refuses("rename", { kind: "schema", from: "Order", to: "Invoice" }, f);
  });
  for (const header of ["// Generated by a tool; do not edit.", "// _generated: do not edit."]) {
    it(`add-field and rename on a schema file whose first line is \`${/^(\/\/|#) _?[Gg]enerated/.exec(header)?.[0] ?? header}\` are refused with E1005`, () => {
      refuses("add-field", { schema: "Order", field: "note", type: "string.optional" }, withGenerated(header));
      refuses("rename", { kind: "schema", from: "Order", to: "Invoice" }, withGenerated(header));
    });
  }
  it("operations that do not touch the placed sources leave OrdersApi.schema.ts and api.server.ts byte-identical", () => {
    fc.assert(
      fc.property(lowerName, (n) => {
        const f = apply("service", SERVICE_INPUT, freshNode()).files;
        const out = apply("store", { id: `orders.${n}` }, f).files;
        expect(out.get("modules/orders/OrdersApi.schema.ts")).toBe(ORDERS_API_SCHEMA);
        expect(out.get("modules/orders/api.server.ts")).toBe(ORDERS_API_SERVICE);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
