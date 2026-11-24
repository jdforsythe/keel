import type { CtxEvent } from "@keel/ctx";

/** The part of an observer event a trace compares: its kind and the plain fields that say what happened. */
export function traceEvent(e: CtxEvent): Record<string, unknown> {
  switch (e.kind) {
    case "nav":
      return { kind: e.kind, href: e.href, route: e.route.id };
    case "fire":
      return { kind: e.kind, id: e.id, event: e.event };
    case "resource":
      return { kind: e.kind, id: e.id, state: e.state };
    case "error":
      return { kind: e.kind, code: e.error.code };
    case "save":
      return { kind: e.kind, store: e.store, head: e.head, from: e.from };
    case "net":
      return { kind: e.kind, online: e.online };
  }
}
