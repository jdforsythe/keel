// Spec: k.store, clause "A payload's `s.secret` value is `reveal`able in `log()`; `snapshot()` then holds no secret and restores the same state."
// Seed 1337
import { scope } from "@keel/reactive";
import { reveal, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const opts = { seed: 1337, numRuns: 30 };

const Counter = s.object({ total: s.int() });
const Secretive = s.object({ token: s.secret(s.string()), n: s.int() });
const Plain = s.object({ n: s.int() });

function make(initial: { total: number } = { total: 0 }) {
  const box: { v: { value: ReturnType<typeof build> } | undefined } = { v: undefined };
  const sc = scope(() => {
    box.v = { value: build(initial) };
  });
  void sc;
  if (box.v === undefined) throw new Error("scope body did not run");
  return box.v.value;
}

function build(initial: { total: number }) {
  const counter = store(Counter, initial);
  const secretAdd = transaction(counter, "ctr.secretAdd", Secretive, (state, { n }) => ({ total: state.total + n }));
  const plainAdd = transaction(counter, "ctr.plainAdd", Plain, (state, { n }) => ({ total: state.total + n }));
  return { counter, secretAdd, plainAdd };
}

type Step = { kind: "secret"; token: string; n: number } | { kind: "plain"; n: number };

const tokenArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 8, maxLength: 12 })
  .map((cs) => `tok-${cs.join("")}`);
const nArb = fc.integer({ min: -100, max: 100 });
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ token: tokenArb, n: nArb }).map((r): Step => ({ kind: "secret", ...r })),
  nArb.map((n): Step => ({ kind: "plain", n })),
);
const stepsArb = fc.array(stepArb, { maxLength: 15 });

const Tokened = s.object({ token: s.secret(s.string()) });

/** A typed payload holds a `Secret`, which only parsing makes. */
function sealed(token: string, n: number) {
  const p = Secretive.parse({ token, n });
  if (!p.ok) throw new Error("secret payload did not parse");
  return p.value;
}

describe("k.store: secret payloads", () => {
  it("each tx whose payload holds an s.secret value returns ok", () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const k = make();
        for (const st of steps) {
          const r = st.kind === "secret" ? tx(k.secretAdd, sealed(st.token, st.n)) : tx(k.plainAdd, { n: st.n });
          expect(r.ok).toBe(true);
        }
      }),
      opts,
    );
  });

  it("the secret value of each such entry is reveal-able in log() and equals the string sent", () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const k = make();
        for (const st of steps) {
          if (st.kind === "secret") tx(k.secretAdd, sealed(st.token, st.n));
          else tx(k.plainAdd, { n: st.n });
        }
        const sent = steps.flatMap((st) => (st.kind === "secret" ? [st.token] : []));
        const got: string[] = [];
        for (const e of k.counter.log()) {
          if (e.name !== "ctr.secretAdd") continue;
          const p = Tokened.parse(e.payload);
          if (!p.ok) throw new Error("logged payload lost its secret");
          got.push(reveal(p.value.token));
        }
        expect(got).toEqual(sent);
      }),
      opts,
    );
  });

  it("snapshot() holds no sent token and no marker, and its log is the entries after the last secret one", () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const k = make();
        for (const st of steps) {
          if (st.kind === "secret") tx(k.secretAdd, sealed(st.token, st.n));
          else tx(k.plainAdd, { n: st.n });
        }
        const json = JSON.stringify(k.counter.snapshot());
        for (const st of steps) if (st.kind === "secret") expect(json).not.toContain(st.token);
        expect(json).not.toContain("[secret]");
        let last = -1;
        steps.forEach((st, i) => {
          if (st.kind === "secret") last = i;
        });
        const expected = steps
          .slice(last + 1)
          .map((st) => ({ name: "ctr.plainAdd", payload: { n: st.kind === "plain" ? st.n : 0 } }));
        expect(k.counter.snapshot().log.map((e) => ({ name: e.name, payload: e.payload }))).toEqual(expected);
      }),
      opts,
    );
  });

  it("restoring the JSON of snapshot() into a fresh store gives the same state, and replaying its kept log from initial reproduces it", () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const src = make();
        for (const st of steps) {
          if (st.kind === "secret") tx(src.secretAdd, sealed(st.token, st.n));
          else tx(src.plainAdd, { n: st.n });
        }
        const snap = src.counter.snapshot();
        const dst = make();
        dst.counter.restore(JSON.parse(JSON.stringify(snap)));
        expect(dst.counter.snapshot().state).toEqual(snap.state);
        const replayed = make({ total: snap.initial.total });
        for (const e of snap.log) expect(tx(replayed.plainAdd, e.payload).ok).toBe(true);
        expect(replayed.counter.snapshot().state).toEqual(snap.state);
      }),
      opts,
    );
  });
});
