import { s } from "@keel/schema";

/** A write queued under an owner, met by a request with no one signed in (`writeFor`). */
export const Signin = s.error("offline.signin", s.object({}));
