// Spec: k.cli, clause "A dev `createApp` serves each registered section as `{ doc, value }`; one whose value fails its
// schema is `{ doc, error }` with E1057; a second `inspector` with that id throws E1057."
// @vitest-environment happy-dom
// Seed 1337. The inspector registry is process-global: every test uses a unique id.
import { inspector } from "@keel/compiler/inspect/inspector";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { BASE, SEED, build } from "./fixtures.ts";

let seq = 0;
const uid = (p: string): string => `${p}.t${++seq}`;

async function sections(extra: Parameters<typeof build>[2] = {}): Promise<Record<string, unknown>> {
  const { app } = await build({}, "dev", extra);
  const res = await app.fetch(new Request(`${BASE}/__keel/inspect`));
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  const sec = Reflect.get(Object(body), "sections");
  return Object(sec);
}

describe("k.cli inspector hooks (server)", () => {
  test("A dev `createApp` serves each registered section as `{ doc, value }`", async () => {
    const Schema = s.object({ n: s.int() });
    await fc.assert(
      fc.asyncProperty(fc.integer(), async (n) => {
        const id = uid("orders.ok");
        inspector({ id, schema: Schema, read: () => ({ n }) });
        const secs = await sections();
        expect(secs[id]).toEqual({ doc: Schema.doc(), value: Schema.encode({ n }) });
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("a section whose value fails its schema is `{ doc, error }` with E1057, and the dev log gets an E1057 line", async () => {
    const Schema = s.int();
    const id = uid("orders.bad");
    inspector({ id, schema: Schema, read: () => 1.5 });
    const lines: string[] = [];
    const secs = await sections({ log: { format: "compact", write: (l) => lines.push(l) } });
    const sec = Object(secs[id]);
    expect(sec.doc).toBe(Schema.doc());
    expect(String(sec.error)).toContain("E1057");
    expect("value" in sec).toBe(false);
    expect(lines.some((l) => l.startsWith("E1057"))).toBe(true);
  });

  test("a section whose `read` throws is `{ doc, error }` with E1057 and does not fail the document", async () => {
    const Schema = s.int();
    const id = uid("orders.throw");
    inspector({
      id,
      schema: Schema,
      read: () => {
        throw new Error("nope");
      },
    });
    const secs = await sections();
    const sec = Object(secs[id]);
    expect(String(sec.error)).toContain("E1057");
    expect("value" in sec).toBe(false);
  });

  test("a second `inspector` with that id throws E1057", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (name) => {
        const id = uid(`dup.${name}`);
        const def = { id, schema: s.int(), read: () => 1 };
        inspector(def);
        let caught: unknown;
        try {
          inspector(def);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(Error);
        expect(caught instanceof Error ? caught.message : "").toMatch(/^E1057/);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
