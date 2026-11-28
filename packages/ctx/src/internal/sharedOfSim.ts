import type { KeyValueStorage } from "../KeyValueStorage.ts";
import type { SimShared } from "./SimShared.ts";
import { realmShared } from "./realmShared.ts";

/** The shared state behind each sim storage object, so a replica's storage is made on the same data. */
export const sharedOfSim: WeakMap<KeyValueStorage, SimShared> = realmShared("keel.simStorageShared");
