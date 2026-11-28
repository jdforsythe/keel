// Seed 1337. Secret payloads and the snapshot fold: undo against the live store and a restored one.
import { scope } from "@keel/reactive";
import { reveal, s } from "@keel/schema";
import { expect, test } from "vitest";
import { store, transaction, tx } from "../src/index.ts";

const State = s.object({ n: s.int(), label: s.string() });
const TOKEN = "tok-9f3a-unique";
// Wire data: an unknown payload is validated at run time, which builds the Secret.
const wire = (token: string): unknown => ({ token });

function build(id: string) {
  const c = store(State, { n: 0, label: "" }, { id });
  const add = transaction(c, "sf.add", s.object({ by: s.int() }), (st, p) => ({ ...st, n: st.n + p.by }));
  const login = transaction(c, "sf.login", s.object({ token: s.secret(s.string()) }), (st) => ({ ...st, label: "in" }));
  return { c, add, login };
}

test("snapshot leaves the live log and undo untouched, folded entries stay undoable", () => {
  scope(
    () => {
      const { c, add, login } = build("sf.live");
      tx(add, { by: 1 });
      tx(login, wire(TOKEN));
      tx(add, { by: 10 });
      const before = c.log().map((e) => e.id);
      c.snapshot();
      expect(c.log().map((e) => e.id)).toEqual(before);
      const first = c.log()[1];
      const parsed = first && login.schema.parse(first.payload);
      expect(parsed?.ok && reveal(parsed.value.token)).toBe(TOKEN);
      expect(c.undo()).toBe(true);
      expect(c.undo()).toBe(true);
      expect(c.get("label")).toBe("");
      expect(c.get("n")).toBe(1);
      expect(c.undo()).toBe(true);
      expect(c.undo()).toBe(false);
      expect(c.get("n")).toBe(0);
    },
    { detached: true },
  ).dispose();
});

test("a restored snapshot keeps the folded state and cannot undo folded entries", () => {
  scope(
    () => {
      const { c, add, login } = build("sf.live");
      tx(add, { by: 1 });
      tx(login, wire(TOKEN));
      tx(add, { by: 10 });
      const snap = JSON.parse(JSON.stringify(c.snapshot()));
      expect(snap.log.length).toBe(1);
      expect(snap.initial).toEqual({ n: 1, label: "in" });
      const d = build("sf.twin").c;
      expect(d.restore(snap).ok).toBe(true);
      expect(d.get("n")).toBe(11);
      expect(d.get("label")).toBe("in");
      expect(d.log().length).toBe(1);
      expect(d.undo()).toBe(true);
      expect(d.get("n")).toBe(1);
      expect(d.get("label")).toBe("in");
      expect(d.undo()).toBe(false);
      expect(d.get("n")).toBe(1);
    },
    { detached: true },
  ).dispose();
});

test("undoWhere never matches a folded entry", () => {
  scope(
    () => {
      const { c, add, login } = build("sf.live");
      tx(add, { by: 1 });
      tx(login, wire(TOKEN));
      const snap = JSON.parse(JSON.stringify(c.snapshot()));
      expect(snap.log.length).toBe(0);
      const d = build("sf.twin").c;
      expect(d.restore(snap).ok).toBe(true);
      expect(d.undoWhere((e) => e.name === "sf.login")).toBe(false);
      expect(d.undoWhere(() => true)).toBe(false);
      expect(d.get("label")).toBe("in");
      expect(d.get("n")).toBe(1);
    },
    { detached: true },
  ).dispose();
});

test("the snapshot JSON holds no secret value, in log or initial", () => {
  scope(
    () => {
      const { c, add, login } = build("sf.live");
      tx(login, wire(TOKEN));
      tx(add, { by: 2 });
      const text = JSON.stringify(c.snapshot({ meta: true }));
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain("sf.login");
    },
    { detached: true },
  ).dispose();
});

// `keel check` forbids this reducer (E1303: `reveal` in a transaction function); the runtime does not, so the fold
// treats the revealed value as any state value.
test("a secret copied into state is a state-level value: the fold writes it into initial and state", () => {
  scope(
    () => {
      const c = store(State, { n: 0, label: "" }, { id: "sf.leak" });
      const leak = transaction(c, "sf.leak", s.object({ token: s.secret(s.string()) }), (st, p) => ({
        ...st,
        label: reveal(p.token),
      }));
      tx(leak, wire(TOKEN));
      const text = JSON.stringify(c.snapshot());
      expect(text).toContain(TOKEN);
      expect(JSON.parse(text).initial.label).toBe(TOKEN);
    },
    { detached: true },
  ).dispose();
});
