import type { ReplayGroupOptions } from "@keel/std-sessions/group";
import type { StoresFactory } from "./StoresFactory.ts";

/** What `findRaces` takes: the group's user module and server, as `replayGroup` takes them, and the stores factories. */
export interface FindRacesOptions extends ReplayGroupOptions {
  readonly stores: readonly StoresFactory[];
}
