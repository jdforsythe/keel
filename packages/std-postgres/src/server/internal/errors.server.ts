import type { NotFound } from "../../NotFound.ts";
import type { Unreachable } from "../../Unreachable.ts";

/** The frozen errors std.postgres answers that wrap nothing; none holds a value. */
export const errors: {
  readonly unreachable: Unreachable;
  readonly notFound: NotFound;
} = Object.freeze({
  unreachable: Object.freeze({ code: "keel.unreachable", message: "The database did not answer", data: null }),
  notFound: Object.freeze({ code: "keel.notFound", message: "No row matched", data: null }),
});
