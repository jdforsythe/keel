/** Statically resolved shape of a schema expression (`s.object`, `s.array`, `s.union`, `s.literal`). */
export type Shape =
  | { kind: "object"; fields: Map<string, Shape> }
  | { kind: "array"; item: Shape }
  | { kind: "union"; key: string; tags: string[] }
  | { kind: "literal"; value: string }
  | { kind: "unknown" };
