import { keelError } from "@keel/schema";

/** The answer to a request no member made. */
export const denied = keelError.denied.make({}, "sign in first");
