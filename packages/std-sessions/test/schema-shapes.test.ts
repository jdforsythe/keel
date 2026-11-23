// The session schemas, each loaded inside the test that reads it: what a `SessionEvent`, a `Session`, a `SessionGroup`,
// the `std` config and the output records accept and refuse, and the names they are registered under.
// This file imports no source at the top: a schema's module is first evaluated by the test that asserts on it.
// Seed 1337
import { clientStdData } from "@keel/compiler/std/clientStdData";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const ID = "de36c499-eccd-4673-b35d-ceb5c9d615ab";
const session = {
  v: 1,
  id: ID,
  seed: 7,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "7f3a9c01d2e4",
};
const without = (value: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));

test("SessionEvent: each kind parses with its own fields, and with no other", async () => {
  const { SessionEvent } = await import("../src/SessionEvent.ts");
  const events: Record<string, unknown>[] = [
    { at: 1, kind: "tx", store: "cart", name: "cart.add", payload: { sku: "a" } },
    { at: 1, kind: "nav", href: "/cart" },
    { at: 1, kind: "resource", id: "cart.items", state: "loading" },
    { at: 1, kind: "resource", id: "cart.items", state: "ready" },
    { at: 1, kind: "resource", id: "cart.items", state: "error" },
    { at: 1, kind: "error", route: "cart.show", error: { code: "cart.full", message: "full", data: null } },
    { at: 1, kind: "net", online: false },
    { at: 1, kind: "fire", id: "cart.add", event: { type: "click" } },
    { at: 1, kind: "fire", id: "cart.qty", event: { type: "input", value: "2" } },
    { at: 1, kind: "fire", id: "cart.qty", event: { type: "change" } },
    { at: 1, kind: "fire", id: "cart.qty", event: { type: "keydown", key: "Enter" } },
    { at: 1, kind: "fire", id: "cart.form", event: { type: "submit" } },
    { at: 1, kind: "fire", id: "cart.qty", event: { type: "focus" } },
    { at: 1, kind: "fire", id: "cart.qty", event: { type: "blur" } },
    { at: 1, kind: "fire", id: "cart.map", event: { type: "emit", detail: { zoom: 3 } } },
  ];
  for (const e of events) {
    const parsed = SessionEvent.parse(e);
    expect(parsed.ok, JSON.stringify(e)).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual(e);
    expect(SessionEvent.parse({ ...e, extra: 1 }).ok, `extra key on ${JSON.stringify(e)}`).toBe(false);
    for (const key of Object.keys(e))
      expect(SessionEvent.parse(without(e, key)).ok, `${JSON.stringify(e)} without ${key}`).toBe(false);
  }
  expect(SessionEvent.parse({ at: 1, kind: "", href: "/" }).ok).toBe(false);
  expect(SessionEvent.parse({ at: 1, kind: "other" }).ok).toBe(false);
  expect(SessionEvent.parse({ at: 1, kind: "resource", id: "x", state: "" }).ok).toBe(false);
  expect(SessionEvent.parse({ at: 1, kind: "resource", id: "x", state: "done" }).ok).toBe(false);
  expect(SessionEvent.parse({ at: "1", kind: "nav", href: "/" }).ok).toBe(false);
  expect(SessionEvent.parse({ at: 1, kind: "nav", href: 5 }).ok).toBe(false);
  expect(SessionEvent.parse({ at: 1, kind: "net", online: "yes" }).ok).toBe(false);
});

test("SessionEvent: a fire's event and an error's error are closed objects of their own", async () => {
  const { SessionEvent } = await import("../src/SessionEvent.ts");
  const fire = (event: unknown) => SessionEvent.parse({ at: 1, kind: "fire", id: "a", event }).ok;
  expect(fire({ type: "click", extra: 1 })).toBe(false);
  expect(fire({ type: "" })).toBe(false);
  expect(fire({ type: "hover" })).toBe(false);
  expect(fire({ type: "input" })).toBe(false);
  expect(fire({ type: "input", value: 2 })).toBe(false);
  expect(fire({ type: "keydown" })).toBe(false);
  expect(fire({ type: "emit" })).toBe(false);
  expect(fire({})).toBe(false);
  const error = (e: unknown) => SessionEvent.parse({ at: 1, kind: "error", route: "r", error: e }).ok;
  expect(error({ code: "c", message: "m", data: null, extra: 1 })).toBe(false);
  expect(error({ code: "c", message: "m" })).toBe(false);
  expect(error({ code: 1, message: "m", data: null })).toBe(false);
  expect(error({ code: "c", message: 1, data: null })).toBe(false);
  expect(error({})).toBe(false);
});

test("Session: a session parses whole; every field but seed is required and no other key is taken", async () => {
  const { Session } = await import("../src/Session.schema.ts");
  const parsed = Session.parse(session);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value).toEqual(session);
  expect(Session.parse(without(session, "seed")).ok).toBe(true);
  for (const key of Object.keys(session).filter((k) => k !== "seed"))
    expect(Session.parse(without(session, key)).ok, `without ${key}`).toBe(false);
  expect(Session.parse({ ...session, extra: 1 }).ok).toBe(false);
  expect(Session.parse({ ...session, v: 2 }).ok).toBe(false);
  expect(Session.parse({ ...session, deterministic: "yes" }).ok).toBe(false);
  expect(Session.parse({ ...session, events: [{ at: 1, kind: "nav" }] }).ok).toBe(false);
  expect(Session.parse({ ...session, events: [{ at: 1, kind: "nav", href: "/" }] }).ok).toBe(true);
  expect(Session.parse(null).ok).toBe(false);
  expect(Session.parse("session").ok).toBe(false);
});

test("Session: route and error are closed objects", async () => {
  const { Session } = await import("../src/Session.schema.ts");
  const route = (r: unknown) => Session.parse({ ...session, route: r }).ok;
  expect(route({ id: "a", params: { n: 1 }, search: { q: "x" } })).toBe(true);
  expect(route({ id: "a", params: {}, search: {}, extra: 1 })).toBe(false);
  expect(route({ id: "a", params: {} })).toBe(false);
  expect(route({ id: "a", search: {} })).toBe(false);
  expect(route({ params: {}, search: {} })).toBe(false);
  expect(route({})).toBe(false);
  const error = (e: unknown) => Session.parse({ ...session, error: e }).ok;
  expect(error({ code: "c", message: "m", data: { a: 1 } })).toBe(true);
  expect(error({ code: "c", message: "m", data: null, extra: 1 })).toBe(false);
  expect(error({ code: "c", data: null })).toBe(false);
  expect(error({ message: "m", data: null })).toBe(false);
  expect(error({})).toBe(false);
});

test("Session: an id is a token of 1 to 64 letters, digits, '_' and '-', and a bad one is an issue at `id`", async () => {
  const { Session } = await import("../src/Session.schema.ts");
  const id = (value: unknown) => Session.parse({ ...session, id: value });
  for (const good of ["a", "A-b_9", "x".repeat(64), ID]) {
    const r = id(good);
    expect(r.ok, good).toBe(true);
    if (r.ok) expect(r.value.id).toBe(good);
  }
  for (const bad of ["", "x".repeat(65), "a b", "a/b", "../a", "a.json", "é", " a", "a\n", "!a", "a!", 5, null]) {
    const r = id(bad);
    expect(r.ok, String(bad)).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/^\w+ at id$/);
  }
  fc.assert(
    fc.property(
      fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/),
      fc.constantFrom("/", ".", " ", "\\", "%", ":"),
      (token, c) => {
        expect(id(token).ok).toBe(true);
        expect(id(`${token}${c}`).ok).toBe(false);
        expect(id(`${c}${token}`).ok).toBe(false);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});

test("Session is registered as `sessions.Session` and keeps the id rule there", async () => {
  const { Session } = await import("../src/Session.schema.ts");
  const registered = s.registry().get("sessions.Session");
  expect(registered).toBe(Session);
  expect(registered?.parse({ ...session, id: "a/b" }).ok).toBe(false);
  expect(Session.node.kind).toBe("object");
  expect(Session.encode).toBeTypeOf("function");
});

test("SessionGroup: registered as `sessions.SessionGroup`; closed, with schedule optional", async () => {
  const { SessionGroup } = await import("../src/group/SessionGroup.schema.ts");
  expect(s.registry().get("sessions.SessionGroup")).toBe(SessionGroup);
  const group = { v: 1, seed: 7, at: 0, origin: "http://group.test", server: {}, users: [session] };
  const parsed = SessionGroup.parse(group);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value).toEqual(group);
  for (const key of Object.keys(group)) expect(SessionGroup.parse(without(group, key)).ok, key).toBe(false);
  expect(SessionGroup.parse({ ...group, extra: 1 }).ok).toBe(false);
});

test("SessionsConfig: registered under the package name; three optional string lists; only redact reaches a browser", async () => {
  const { SessionsConfig } = await import("../src/SessionsConfig.ts");
  expect(s.registry().get("@keel/std-sessions")).toBe(SessionsConfig);
  expect(SessionsConfig.parse({}).ok).toBe(true);
  const full = { redact: ["tx:a.b#c"], expose: ["store:a#n"], readers: ["h1"] };
  const parsed = SessionsConfig.parse(full);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value).toEqual(full);
  expect(SessionsConfig.parse({ other: [] }).ok).toBe(false);
  expect(SessionsConfig.parse({ redact: "tx:a.b#c" }).ok).toBe(false);
  expect(SessionsConfig.parse({ expose: [1] }).ok).toBe(false);
  expect(SessionsConfig.parse({ readers: [null] }).ok).toBe(false);
  expect(clientStdData({ "@keel/std-sessions": { app: full } }, new Set(["app"]))).toEqual({
    "@keel/std-sessions": { app: { redact: ["tx:a.b#c"] } },
  });
});

test("SessionRecord: the `session` record, closed, with a nullable error and file", async () => {
  const { SessionRecord } = await import("../src/SessionRecord.ts");
  const record = {
    kind: "session",
    id: ID,
    fingerprint: "7f3a9c01d2e4",
    route: "cart.show",
    events: 4,
    inputs: 2,
    error: null,
    file: null,
  };
  expect(SessionRecord.parse(record).ok).toBe(true);
  expect(SessionRecord.parse({ ...record, error: "cart.full", file: "a.json" }).ok).toBe(true);
  for (const key of Object.keys(record)) expect(SessionRecord.parse(without(record, key)).ok, key).toBe(false);
  expect(SessionRecord.parse({ ...record, extra: 1 }).ok).toBe(false);
  expect(SessionRecord.parse({ ...record, kind: "" }).ok).toBe(false);
  expect(SessionRecord.parse({ ...record, kind: "session.monitor" }).ok).toBe(false);
  expect(SessionRecord.parse({ ...record, events: 1.5 }).ok).toBe(false);
});

test("SessionMonitorRecord: the `session.monitor` record, closed, and its compact and pretty lines", async () => {
  const { SessionMonitorRecord } = await import("../src/SessionMonitorRecord.ts");
  const { respond } = await import("@keel/cli/testing");
  const record = { kind: "session.monitor", origin: "https://app.test", transactions: 3, runs: 12, file: "m.json" };
  expect(SessionMonitorRecord.parse(record).ok).toBe(true);
  for (const key of Object.keys(record)) expect(SessionMonitorRecord.parse(without(record, key)).ok, key).toBe(false);
  expect(SessionMonitorRecord.parse({ ...record, extra: 1 }).ok).toBe(false);
  expect(SessionMonitorRecord.parse({ ...record, kind: "" }).ok).toBe(false);
  expect(SessionMonitorRecord.parse({ ...record, runs: "12" }).ok).toBe(false);
  expect(respond([record]).stdout.split("\n")[0]).toBe("ok session monitor 3 transactions, 12 runs -> m.json");
  expect(respond([record], { format: "pretty" }).stdout).toContain(
    "ok session monitor 3 transactions, 12 runs -> m.json\n  origin: https://app.test",
  );
  expect(respond([{ ...record, extra: 1 }]).stdout).toContain("E1054");
});

test("Archive: fingerprint entries of count, first, last and filed sessions, each closed", async () => {
  const { Archive } = await import("../src/Archive.schema.ts");
  const entry = { count: 1, first: 0, last: 0, sessions: [{ bytes: 10, session }] };
  expect(Archive.parse({}).ok).toBe(true);
  expect(Archive.parse({ f1: entry }).ok).toBe(true);
  for (const key of Object.keys(entry)) expect(Archive.parse({ f1: without(entry, key) }).ok, key).toBe(false);
  expect(Archive.parse({ f1: { ...entry, extra: 1 } }).ok).toBe(false);
  expect(Archive.parse({ f1: { ...entry, count: 0 } }).ok).toBe(false);
  expect(Archive.parse({ f1: { ...entry, sessions: [{ bytes: -1, session }] } }).ok).toBe(false);
  expect(Archive.parse({ f1: { ...entry, sessions: [{ bytes: 0, session }] } }).ok).toBe(true);
  expect(Archive.parse({ f1: { ...entry, sessions: [{ bytes: 1, session, extra: 1 }] } }).ok).toBe(false);
  expect(Archive.parse({ f1: { ...entry, sessions: [{ bytes: 1 }] } }).ok).toBe(false);
  expect(Archive.parse({ f1: { ...entry, sessions: [{ session }] } }).ok).toBe(false);
});
