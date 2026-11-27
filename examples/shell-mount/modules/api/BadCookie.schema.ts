import { s } from "@keel/schema";

/** A `demo-user` cookie whose value is no URI-encoded text: the request is no one's. */
export const BadCookie = s.error("api.badCookie", s.object({}));
