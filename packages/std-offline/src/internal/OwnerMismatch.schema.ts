import { s } from "@keel/schema";

/** A write queued under one owner, met by a request of another (`writeFor`). */
export const OwnerMismatch = s.error("offline.owner", s.object({}));
