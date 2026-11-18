import type { Clock } from "./Clock.ts";
import type { KeyValueStorage } from "./KeyValueStorage.ts";
import type { Net } from "./Net.ts";
import type { Random } from "./Random.ts";

/** The effect context: every effect goes through one of these capabilities. */
export interface Ctx {
  readonly clock: Clock;
  readonly random: Random;
  readonly net: Net;
  readonly storage: KeyValueStorage;
}
