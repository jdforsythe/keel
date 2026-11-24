import type { CtxEvent } from "@keel/ctx";

/**
 * The part of an observer event a trace compares: its kind and the plain fields that say what happened. A `resource`
 * event's id is a counter of the process, so `resourceId` gives the run's own name for it (k.drive-law Law).
 */
export function traceEvent(e: CtxEvent, resourceId: (id: string) => string = (id) => id): Record<string, unknown> {
  switch (e.kind) {
    case "nav":
      return { kind: e.kind, href: e.href, route: e.route.id };
    case "fire":
      return { kind: e.kind, id: e.id, event: e.event };
    case "resource":
      return { kind: e.kind, id: resourceId(e.id), state: e.state };
    case "error":
      return { kind: e.kind, code: e.error.code };
    case "save":
      return { kind: e.kind, store: e.store, head: e.head, from: e.from };
    case "net":
      return { kind: e.kind, online: e.online };
  }
}
