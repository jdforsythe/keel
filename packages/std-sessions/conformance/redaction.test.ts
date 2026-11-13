// @vitest-environment happy-dom
// Spec: std.sessions, clause "A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema."
// Seed 1337
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { type Schema, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { Session, record } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, fixture, json, play, simCtx } from "./fixtures.ts";

// Generated payload schemas: string leaves of at least 12 characters, objects and arrays, some nodes marked `.pii(class)`.
const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
type Mark = (typeof CLASSES)[number] | null;
type Piece =
  | { readonly kind: "string"; readonly mark: Mark }
  | { readonly kind: "array"; readonly item: Piece; readonly mark: Mark }
  | { readonly kind: "object"; readonly fields: readonly Piece[]; readonly mark: Mark };
const markArb: fc.Arbitrary<Mark> = fc.option(fc.constantFrom(...CLASSES), { freq: 3, nil: null });
const pieceArb = (depth: number): fc.Arbitrary<Piece> =>
  depth <= 0
    ? fc.record({ kind: fc.constant("string" as const), mark: markArb })
    : fc.oneof(
        fc.record({ kind: fc.constant("string" as const), mark: markArb }),
        fc.record({ kind: fc.constant("array" as const), item: pieceArb(depth - 1), mark: markArb }),
        fc.record({
          kind: fc.constant("object" as const),
          fields: fc.array(pieceArb(depth - 1), { minLength: 1, maxLength: 3 }),
          mark: markArb,
        }),
      );
const marked = (p: Piece): boolean =>
  p.mark !== null || (p.kind === "array" ? marked(p.item) : p.kind === "object" ? p.fields.some(marked) : false);
const payloadArb: fc.Arbitrary<Piece> = fc
  .array(pieceArb(2), { minLength: 1, maxLength: 3 })
  .map((fields): Piece => ({ kind: "object", fields, mark: null }))
  .filter(marked);
const base = (p: Piece): Schema<unknown> =>
  p.kind === "string"
    ? s.string({ min: 12 })
    : p.kind === "array"
      ? s.array(schemaOf(p.item))
      : s.object(Object.fromEntries(p.fields.map((f, i) => [`f${i}`, schemaOf(f)])));
const schemaOf = (p: Piece): Schema<unknown> => (p.mark === null ? base(p) : base(p).pii(p.mark));
/** The strings of `value` under marked nodes. */
const markedStrings = (p: Piece, value: unknown, inherited = false): string[] => {
  const under = inherited || p.mark !== null;
  if (p.kind === "array") return Array.isArray(value) ? value.flatMap((v) => markedStrings(p.item, v, under)) : [];
  if (p.kind === "object")
    return typeof value === "object" && value !== null
      ? p.fields.flatMap((f, i) => markedStrings(f, Reflect.get(value, `f${i}`), under))
      : [];
  return under && typeof value === "string" ? [value] : [];
};

let captures = 0;
/** One click that runs a transaction with `payload` under `schema`; returns the session and the transaction's name. */
async function capture(schema: Schema<unknown>, payload: unknown) {
  const id = `piip${captures++}`;
  const name = `${id}.set`;
  const ctx = simCtx();
  const rec = record(ctx);
  const built: { st: ReturnType<typeof store<{ last: string }>>; routes: ReturnType<typeof table> }[] = [];
  const table = (go: () => void) =>
    manifest({
      "piip.show": {
        path: "/piip",
        component(): Node {
          return Box({
            as: "main",
            id: "piip.page",
            children: [Button({ id: "piip.go", children: "Go", onClick: go })],
          });
        },
      },
    });
  scope(() => {
    const st = store(s.object({ last: s.string() }), { last: "" }, { id });
    const t = transaction(st, name, schema, (state) => state);
    built.push({ st, routes: table(() => void tx(t, payload)) });
  });
  const [b] = built;
  if (b === undefined) throw new Error("capture: build failed");
  const h = await renderRoute("piip.show", { routes: b.routes, ctx, state: [[b.st, { last: "" }]] });
  await h.fire("piip.go", { type: "click" });
  const session = rec.stop();
  h.dispose();
  return { session, name };
}

describe("std.sessions: redaction", () => {
  // The module lists the payload path and the card input (`el:`), which carries the same value; `play` binds them.
  const redact = ["tx:cart.pay#card.number", "el:cart.card#value"];
  test("A redacted payload value never appears in the session JSON", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }], { redact });
        expect(json(session)).not.toContain(JSON.stringify(secret).slice(1, -1));
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test("and the redacted payload parses with its transaction's schema", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 12, maxLength: 24 }), async (secret) => {
        const { session } = await play(SEED, [{ id: "cart.card", value: secret }], { redact });
        for (const e of session.events)
          if (e.kind === "tx" && e.name === "cart.pay") expect(fixture().pay.schema.parse(e.payload).ok).toBe(true);
        expect(Session.parse(JSON.parse(json(session))).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  // Spec: std.sessions Conformance sentence above, over payload schemas with `.pii()` fields.
  test("A marked payload value never appears in the session JSON, and the payload parses with its transaction's schema, for every generated payload schema with .pii() fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        payloadArb.chain((piece) => fc.tuple(fc.constant(piece), gen(schemaOf(piece)))),
        async ([piece, value]) => {
          const schema = schemaOf(piece);
          const { session, name } = await capture(schema, value);
          const text = json(session);
          for (const v of markedStrings(piece, schema.encode(value)))
            expect(text).not.toContain(JSON.stringify(v).slice(1, -1));
          const sent = session.events.filter((e) => e.kind === "tx" && e.name === name);
          expect(sent.length).toBeGreaterThan(0);
          for (const e of sent) if (e.kind === "tx") expect(schema.parse(e.payload).ok).toBe(true);
          expect(Session.parse(JSON.parse(text)).ok).toBe(true);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
