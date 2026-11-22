import { s } from "@keel/schema";

/** Who the request is signed in as. */
export const Me = s.object({ name: s.string().pii("name") });
