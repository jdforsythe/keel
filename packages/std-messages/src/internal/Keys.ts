import type { Schema } from "@keel/schema";

/** A set's keys, each mapped to its params' schemas (`{}` for a key without params). */
export type Keys = Readonly<Record<string, Readonly<Record<string, Schema<unknown, boolean>>>>>;
