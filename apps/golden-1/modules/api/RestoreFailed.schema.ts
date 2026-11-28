import { s } from "@keel/schema";

export const RestoreFailed = s.error("api.restoreFailed", s.object({ cause: s.string() }));
