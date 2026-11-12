import { s } from "@keel/schema";

const at = s.number();
/** A closed object (every session shape rejects unknown keys). */
const o = <S extends Parameters<typeof s.object>[0]>(shape: S) => s.object(shape, { closed: true });
const keelError = o({ code: s.string(), message: s.string(), data: s.json() });
const testEvent = s.union("type", [
  o({ type: s.literal("click") }),
  o({ type: s.literal("input"), value: s.string() }),
  o({ type: s.literal("change") }),
  o({ type: s.literal("keydown"), key: s.string() }),
  o({ type: s.literal("submit") }),
  o({ type: s.literal("focus") }),
  o({ type: s.literal("blur") }),
]);

/**
 * One recorded event (std.sessions): `at` is `ctx.clock.now()` when it was appended. A `nav` keeps the href as a
 * string; `replay` re-derives a typed `Href` from the route table. An `error` keeps the id of the route it fired
 * under (the latest `nav`'s, else the base's), so the fingerprint is recomputable from the session alone.
 */
export const SessionEvent = s.union("kind", [
  o({ at, kind: s.literal("tx"), store: s.string(), name: s.string(), payload: s.json() }),
  o({ at, kind: s.literal("nav"), href: s.string() }),
  o({ at, kind: s.literal("resource"), id: s.string(), state: s.enum(["loading", "ready", "error"]) }),
  o({ at, kind: s.literal("fire"), id: s.string(), event: testEvent }),
  o({ at, kind: s.literal("error"), route: s.string(), error: keelError }),
  o({ at, kind: s.literal("net"), online: s.boolean() }),
]);
export type SessionEvent = s.infer<typeof SessionEvent>;
