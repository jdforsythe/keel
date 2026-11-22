import type { FollowEvent } from "../FollowEvent.ts";

/**
 * Where a database's changes are followed. `follow` resolves the stop once `on` will get each committed change whose
 * payload is `text`; `committed` hands the payloads of one committed transaction to the follows this process delivers
 * itself (PGlite and sim; on Postgres the listening connection delivers them).
 */
export type Changes = {
  follow(text: string, on: (e: FollowEvent) => void): Promise<() => void>;
  committed(texts: readonly string[]): void;
};
