/** A rendered child of a structural op: its top-level nodes, re-read after each (re)render. */
export interface Unit {
  nodes(): readonly Node[];
  dispose(): void;
}
