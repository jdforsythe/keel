import type { Infer, Schema } from "@keel/schema";
import type { Message } from "../Message.ts";
import type { Keys } from "./Keys.ts";

/** A param as `formatMessage` takes it: text (an enum's value included) or a number. */
type Param<S extends Schema<unknown, boolean>> = Infer<S> extends number ? number : string;

/** One locale's entry of a set: a string for each key without params, a `Message` typed by its params otherwise. */
export type Entry<K extends Keys> = {
  readonly [Key in keyof K]: keyof K[Key] extends never
    ? string
    : Message<{ readonly [P in keyof K[Key]]: K[Key][P] extends Schema<unknown, boolean> ? Param<K[Key][P]> : never }>;
};
