// Seed 1337. A state schema holding a secret is refused at construction, and the snapshot error names E1303 and a path.
import { scope } from "@keel/reactive";
import { type SchemaError, s } from "@keel/schema";
import { expect, test } from "vitest";
import { store } from "../src/index.ts";
import { unpersisted } from "../src/internal/unpersisted.ts";

const refused = (schema: Parameters<typeof store>[0], initial: object, id = "sg.c"): string => {
  let message = "";
  scope(
    () => {
      try {
        store(schema, initial, { id });
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      }
    },
    { detached: true },
  ).dispose();
  return message;
};

test("the message names E1303, the store id and the first secret's path", () => {
  const State = s.object({ a: s.string(), creds: s.object({ pin: s.int(), token: s.secret(s.string()) }) });
  expect(refused(State, {})).toBe(
    "E1303: store sg.c: state schema holds s.secret at creds.token; state never holds a secret",
  );
  expect(refused(s.object({ l: s.array(s.record(s.secret(s.int()).nullable())) }), {})).toBe(
    "E1303: store sg.c: state schema holds s.secret at l; state never holds a secret",
  );
  const tagged = s.object({
    u: s.union("t", [s.object({ t: s.literal("a") }), s.object({ t: s.literal("b"), k: s.secret(s.string()) })]),
  });
  expect(refused(tagged, {})).toContain("at u.k;");
  expect(refused(s.object({ m: s.union([s.int(), s.secret(s.string())]) }), {})).toContain("at m;");
  expect(refused(s.object({ o: s.secret(s.string()).optional() }), {})).toContain("at o;");
});

test("the guard runs before the id is registered and before the initial state is read", () => {
  expect(refused(s.object({ t: s.secret(s.string()) }), { not: "valid" }, "sg.dup")).toContain("E1303");
  scope(
    () => {
      expect(() => store(s.object({ t: s.string() }), { t: "" }, { id: "sg.dup" })).not.toThrow();
    },
    { detached: true },
  ).dispose();
});

test("a secret-free schema constructs", () => {
  expect(refused(s.object({ a: s.array(s.object({ b: s.string().nullable() })) }), { a: [] })).toBe("");
});

test("the snapshot error names E1303, the part, the path and the rule", () => {
  const issue = (path: (string | number)[]): SchemaError => {
    const r = s.object({ x: s.secret(s.string()) }).parse({ x: "[secret]" });
    if (r.ok) throw new Error("the marker parsed");
    return { ...r.error, data: { issues: [{ path, rule: "secret-missing" }] } };
  };
  expect(unpersisted("c", "state", issue(["a", 0, "t"])).message).toBe(
    "E1303: store c: snapshot state at a.0.t does not persist (secret-missing)",
  );
  expect(unpersisted("c", "log", issue([])).message).toBe(
    "E1303: store c: snapshot log at (root) does not persist (secret-missing)",
  );
  const none = issue([]);
  expect(unpersisted("c", "initial", { ...none, data: { issues: [] } }).message).toBe(
    "E1303: store c: snapshot initial at (root) does not persist",
  );
});
