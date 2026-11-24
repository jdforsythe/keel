import type { FireEvent } from "@keel/ctx";

type KeyDown = Extract<FireEvent, { type: "keydown" }>;
type Change = Extract<FireEvent, { type: "change" }>;

/**
 * The closed set of events `fire` dispatches (k.testing): k.ctx `FireEvent`, with `keydown` also taking the
 * modifiers `shift`, `alt` and `mod` (Ctrl), each false when absent, and `change` an optional `value`, a person's
 * pick in a single `<select>`. `input` sets the element's value first. `emit` stands in for a host element's
 * outside code (k.host-element): `detail` is parsed by its `events` schema.
 */
export type TestEvent =
  | Exclude<FireEvent, KeyDown | Change>
  | (KeyDown & { readonly shift?: boolean; readonly alt?: boolean; readonly mod?: boolean })
  | (Change & { readonly value?: string });
