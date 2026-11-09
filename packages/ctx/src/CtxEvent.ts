import type { KeelError, ObjectSchema } from "@keel/schema";
import type { FireEvent } from "./FireEvent.ts";

/**
 * An event kernel code reports on a ctx (k.ctx Observers, rfc:0070). `nav`: a navigation started (before guards),
 * with the matched route's id, path pattern, decoded params and search, and their schemas. `fire`: an input event
 * dispatched to element `id`, before its handlers (a password `input` value arrives as `x` repeated). `resource`:
 * `Match` rendered a resource state (`id`: the resource's `inspect()` node id). `error`: a Boundary caught, or a loader
 * or action returned `err`.
 */
export type CtxEvent =
  | {
      readonly kind: "nav";
      readonly href: string;
      readonly route: {
        readonly id: string;
        readonly path: string;
        readonly params: Readonly<Record<string, unknown>>;
        readonly search: Readonly<Record<string, unknown>>;
        readonly schemas: {
          readonly params?: ObjectSchema<unknown> | undefined;
          readonly search?: ObjectSchema<unknown> | undefined;
        };
      };
    }
  | { readonly kind: "fire"; readonly id: string; readonly event: FireEvent }
  | { readonly kind: "resource"; readonly id: string; readonly state: "loading" | "ready" | "error" }
  | { readonly kind: "error"; readonly error: KeelError<string, unknown> };
