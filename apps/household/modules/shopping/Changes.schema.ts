import { s } from "@keel/schema";

/** How many times the list has changed since the server started; the list channel watches it. */
export const Changes = s.object({ n: s.int({ min: 0 }) });
