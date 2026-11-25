import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-channels` for a serving module (k.module Std config; server-only), each bound applied
 * to opens on that module's channel routes (std.channels-limits): `perCaller`, one caller's streams with a cookie on
 * this module's routes (default 8); `perAnonymous`, the cookieless streams (caller `""`) on the channel routes of every
 * module served over the process's ctx together (default 64), so they number at most the largest module's value; and
 * `maxStreams`, all streams on this module's routes (default 1,000). Registered under the package name at import, so
 * `check` and `createApp({ std })` validate it.
 */
export const ChannelsConfig = s.object(
  {
    perCaller: s.int({ min: 1 }).optional(),
    perAnonymous: s.int({ min: 1 }).optional(),
    maxStreams: s.int({ min: 1 }).optional(),
  },
  { closed: true },
);
export type ChannelsConfig = s.infer<typeof ChannelsConfig>;
s.register("@keel/std-channels", ChannelsConfig);
