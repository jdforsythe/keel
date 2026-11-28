import type { ObjectSchema } from "@keel/schema";
import type { Entry } from "./internal/Entry.ts";
import type { EntryInput } from "./internal/EntryInput.ts";
import type { Keys } from "./internal/Keys.ts";

/**
 * A message set (std.messages): the closed object schema of one locale's entry, with `text`, a locale file's default
 * export, which parses its entry and throws for one the set refuses, and `load`, which imports a locale's file and
 * parses its entry.
 */
export type MessageSet<L extends string, K extends Keys> = ObjectSchema<Entry<K>> & {
  text(entry: EntryInput<K>): Entry<K>;
  load(locale: L): Promise<Entry<K>>;
};
