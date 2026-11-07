// Spec: k.scaffold, Generators "`service`: endpoint schemas from OpenAPI and the service file (k.services); schemas are generated, read-only."
// Spec: k.scaffold, Turbo emission "Generated files are read-only (E1005)."
// RFC 0036: `service { id: "<module>", schema, service }` places the two sources `@keel/services/openapi` generates at
// modules/<module>/api.schema.ts and modules/<module>/api.ts. A later operation that would change or delete a file whose
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
  apply,
  errText,
  fresh,
  lowerName,
  planOf,
  read,
  scaffoldRaw,
  snap,
} from "./fixtures.ts";

const withModule = (id: string) => apply("module", { id }, fresh()).files;
const input = (id: string) => ({ id, schema: ORDERS_API_SCHEMA, service: ORDERS_API_SERVICE });

describe("scaffold service", () => {
  it("places the schema source and the service source verbatim at modules/<module>/api.schema.ts and api.ts", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const before = withModule(id);
        const out = apply("service", input(id), before);
        expect(out.created).toEqual([`modules/${id}/api.schema.ts`, `modules/${id}/api.ts`]);
        expect(out.removed).toEqual([]);
        expect(read(out.files, `modules/${id}/api.schema.ts`)).toBe(ORDERS_API_SCHEMA);
        expect(read(out.files, `modules/${id}/api.ts`)).toBe(ORDERS_API_SERVICE);
        for (const [p, c] of before) if (!out.changed.includes(p)) expect(out.files.get(p), p).toBe(c);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("both placed sources start with the generated header", () => {
    const out = apply("service", SERVICE_INPUT, fresh()).files;
    for (const p of ["modules/orders/api.schema.ts", "modules/orders/api.ts"])
      expect(read(out, p).split("\n")[0], p).toBe(GENERATED_HEADER);
  });
  it("service --dry-run (plan) yields exactly the edit set the following apply writes", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const files = withModule(id);
        const before = snap(files);
        const p = planOf("service", input(id), files);
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
  it("E1351: an existing handwritten api.ts or api.schema.ts blocks the service and writes nothing", () => {
    for (const existing of ["modules/orders/api.ts", "modules/orders/api.schema.ts"]) {
      const f = fresh();
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

  it("add-field to a schema in a placed api.schema.ts is refused with E1005 and writes nothing", () => {
    const schema = ORDERS_API_SCHEMA.replace("export const OrdersApi", `${ORDER}\nexport const OrdersApi`);
    const f = apply("service", { id: "orders", schema, service: ORDERS_API_SERVICE }, fresh()).files;
    refuses("add-field", { schema: "Order", field: "note", type: "string.optional" }, f);
  });
  it("rename of a schema declared in a placed api.schema.ts is refused with E1005 and writes nothing", () => {
    const schema = ORDERS_API_SCHEMA.replace("export const OrdersApi", `${ORDER}\nexport const OrdersApi`);
    const f = apply("service", { id: "orders", schema, service: ORDERS_API_SERVICE }, fresh()).files;
    refuses("rename", { kind: "schema", from: "Order", to: "Invoice" }, f);
  });
  for (const header of ["// Generated by a tool; do not edit.", "// _generated: do not edit."]) {
    it(`add-field and rename on a schema file whose first line is \`${/^(\/\/|#) _?[Gg]enerated/.exec(header)?.[0] ?? header}\` are refused with E1005`, () => {
      refuses("add-field", { schema: "Order", field: "note", type: "string.optional" }, withGenerated(header));
      refuses("rename", { kind: "schema", from: "Order", to: "Invoice" }, withGenerated(header));
    });
  }
  it("operations that do not touch the placed sources leave api.schema.ts and api.ts byte-identical", () => {
    fc.assert(
      fc.property(lowerName, (n) => {
        const f = apply("service", SERVICE_INPUT, fresh()).files;
        const out = apply("store", { id: `orders.${n}` }, f).files;
        expect(out.get("modules/orders/api.schema.ts")).toBe(ORDERS_API_SCHEMA);
        expect(out.get("modules/orders/api.ts")).toBe(ORDERS_API_SERVICE);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
