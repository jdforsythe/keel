import type { Infer, Schema } from "@keel/schema";
import type { Keys } from "./Keys.ts";

type Params = Readonly<Record<string, Schema<unknown, boolean>>>;
type NumberParam<P extends Params> = { [N in keyof P]: Infer<P[N]> extends number ? N : never }[keyof P] & string;
type Plural<N extends string> = {
  readonly plural: N;
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
};
type Select<P extends Params> = {
  [N in keyof P & string]: Infer<P[N]> extends string
    ? string extends Infer<P[N]>
      ? never
      : { readonly select: N; readonly cases: { readonly [V in Infer<P[N]>]: string } }
    : never;
}[keyof P & string];
type MessageInput<P extends Params> =
  | { readonly text: string }
  | { [N in NumberParam<P>]: Plural<N> }[NumberParam<P>]
  | Select<P>;

/** What a locale file writes for a set: text for a key without params, `{ text }`, a `plural` or a `select` otherwise. */
export type EntryInput<K extends Keys> = {
  readonly [Key in keyof K]: keyof K[Key] extends never ? string : MessageInput<K[Key]>;
};
