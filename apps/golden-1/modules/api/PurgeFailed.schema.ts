import { s } from "@keel/schema";

export const PurgeFailed = s.error("api.purgeFailed", s.object({ cause: s.string() }));
