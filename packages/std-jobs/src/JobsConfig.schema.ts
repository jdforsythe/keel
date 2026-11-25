import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-jobs` per app module (k.module Std config): `concurrency`, the jobs a module's queue
 * runs at once, 1 to 16 (default 1). Registered under the package name at import, so `check` and `createApp({ std })`
 * validate it (E1158).
 */
export const JobsConfig = s.object({ concurrency: s.int({ min: 1, max: 16 }).optional() }, { closed: true });
export type JobsConfig = s.infer<typeof JobsConfig>;
s.register("@keel/std-jobs", JobsConfig);
