import type { Conflict } from "../../Conflict.ts";
import type { NotFound } from "../../NotFound.ts";
import type { Unreachable } from "../../Unreachable.ts";

/** The frozen errors std.postgres answers; none holds a value. */
export const errors: {
  readonly unreachable: Unreachable;
  readonly conflict: Conflict;
  readonly notFound: NotFound;
} = Object.freeze({
  unreachable: Object.freeze({ code: "keel.unreachable", message: "The database did not answer", data: null }),
  conflict: Object.freeze({ code: "keel.conflict", message: "A concurrent write got there first", data: null }),
  notFound: Object.freeze({ code: "keel.notFound", message: "No row matched", data: null }),
});
