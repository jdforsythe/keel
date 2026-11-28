import type { Infer, Schema } from "@keel/schema";

/** Every event's payload fields at once: what a guard or action may read from the payload of the events naming it. */
export type PayloadOf<Ev extends Readonly<Record<string, Schema<unknown>>>> = {
  [K in keyof Ev]: (payload: Infer<Ev[K]>) => void;
}[keyof Ev] extends (payload: infer I) => void
  ? I
  : never;
