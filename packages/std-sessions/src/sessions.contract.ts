import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { Session } from "./Session.schema.ts";
import { Tally } from "./monitor/Tally.schema.ts";
import { ListSearch } from "./routes/ListSearch.schema.ts";
import { Listing } from "./routes/Listing.schema.ts";

/**
 * The `@keel/std-sessions` contract (std.contracts, the `./contract` export): `sessions.ingest` (`POST /sessions`, a
 * `Session`), `sessions.list` (`GET /sessions/list`, query `ListSearch`, answering `Listing`) and `sessions.tally`
 * (`GET /sessions/tally`, answering the `Tally` the `monitor` runner keeps, std.monitor).
 */
export const sessions = contract("sessions", {
  "sessions.ingest": { method: "POST", path: "/sessions", body: Session, output: s.object({}) },
  "sessions.list": { method: "GET", path: "/sessions/list", query: ListSearch, output: Listing },
  "sessions.tally": { method: "GET", path: "/sessions/tally", output: Tally },
});
