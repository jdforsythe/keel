import { s } from "@keel/schema";

/** Input of the `digest.recount` job and of `POST /digest/refresh`: nothing, the job reads the whole board. */
export const RecountInput = s.object({});
export type RecountInput = s.infer<typeof RecountInput>;
