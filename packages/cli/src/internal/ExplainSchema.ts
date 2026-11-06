import { s } from "@keel/schema";

/** `keel explain <code>`: the code's meaning and fix pattern (<= 120 tokens). */
export const ExplainSchema = s.object({ kind: s.literal("explain.text"), code: s.string(), text: s.string() });
