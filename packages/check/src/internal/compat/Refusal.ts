/**
 * Why a schema refuses another (k.compat Accepts), at the first refused field `path`: a field it requires is not
 * required by the other (`missing`), a field a closed object does not declare (`extra`), an open object where a
 * closed one is required (`open`), another kind (`type`), a value it does not hold (`value`), wider bounds (`bounds`),
 * or another format (`format`).
 */
export type Refusal = {
  readonly path: readonly string[];
  readonly why: "missing" | "extra" | "open" | "type" | "value" | "bounds" | "format";
};
