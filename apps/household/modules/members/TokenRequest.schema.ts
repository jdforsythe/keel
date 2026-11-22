import { s } from "@keel/schema";

/** The body of `POST /api/tokens`: how many days the token works, 1 to 90. */
export const TokenRequest = s.object({ days: s.int({ min: 1, max: 90 }) });
