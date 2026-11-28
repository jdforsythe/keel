import { s } from "@keel/schema";

/** A state schema holding two `.pii` classes. */
export const Contact = s.object({ email: s.string().pii("contact"), userId: s.string().pii("identifier") });
