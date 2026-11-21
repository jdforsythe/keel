import type { Computed } from "@keel/reactive";
import type { Schema } from "@keel/schema";
import type { HostCode } from "./HostCode.ts";
import type { StyleProps } from "./StyleProps.ts";

/** A value, a signal or a computed. */
type V<T> = T | Computed<T>;
/** Exactly one of `label` (written as `aria-label`) and `labelledBy` (an element id, `aria-labelledby`). */
type Named =
  | { readonly label: V<string>; readonly labelledBy?: never }
  | { readonly labelledBy: V<string>; readonly label?: never };
/** `onEvent` comes with an `events` schema, which parses every `emit`. */
type Reports<E> =
  | { readonly events?: undefined; readonly onEvent?: undefined }
  | { readonly events: Schema<E>; readonly onEvent?: (e: E) => void };

/**
 * `Host`'s props (k.host-element): `value` is typed as `input`'s value and `code` as a `HostCode` of it, so a
 * mismatch is a type error.
 */
export type HostProps<I, E = never> = StyleProps &
  Named &
  Reports<E> & {
    readonly id: string;
    readonly lang?: string;
    /** `img`: the drawing is one picture; `group`: the outside code's elements are exposed with their own names. */
    readonly role: "img" | "group";
    readonly describedBy?: V<string>;
    readonly input: Schema<I>;
    /** A plain value (read once; a function is a plain value), a signal or a computed. */
    readonly value: I | Computed<I>;
    /** `() => import("./x.ts").then((m) => m.x)` (E1824). */
    readonly code: () => HostCode<I, E> | PromiseLike<HostCode<I, E>>;
  };
