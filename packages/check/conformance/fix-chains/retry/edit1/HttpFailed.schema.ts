import { s } from "@keel/schema";
export const HttpFailed = s.error("feed.http", s.object({ status: s.int() }));
