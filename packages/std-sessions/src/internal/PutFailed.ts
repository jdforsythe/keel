import { s } from "@keel/schema";

/** `sessions.putFailed` (std.sessions API): a put that did not land; `status` is the HTTP status, 0 for no response. */
export const PutFailed = s.error("sessions.putFailed", s.object({ status: s.int() }));
