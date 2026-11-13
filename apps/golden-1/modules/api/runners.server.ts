import { monitor } from "@keel/std-sessions/monitor";

/** The `api` module's background work (k.topology Runners): `monitor` counts each `api.*` commit into `sessions.tally`. */
export const runners = [monitor];
