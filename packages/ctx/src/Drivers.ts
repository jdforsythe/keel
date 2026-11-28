import type { KeyValueStorage } from "./KeyValueStorage.ts";
import type { Net } from "./Net.ts";

/** Capability implementations a `real` or `shell` ctx uses in place of the platform's (k.persist Drivers). */
export interface Drivers {
  readonly storage?: KeyValueStorage;
  readonly net?: Net;
}
