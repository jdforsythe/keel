import { monitor } from "@keel/std-sessions/monitor";

/** The app module's background work (k.topology Runners): `monitor` counts each server-store commit by its transaction's name into `sessions.tally`. */
export const runners = [monitor];
