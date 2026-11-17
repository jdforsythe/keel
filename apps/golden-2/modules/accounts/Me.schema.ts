import { s } from "@keel/schema";

/** The answer of `GET /api/me`: the email of the account the bearer token acts for. */
export const Me = s.object({ email: s.string().pii("contact") });

export type Me = s.infer<typeof Me>;
