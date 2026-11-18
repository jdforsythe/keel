import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-channels` for a serving module (k.module Std config; server-only): `perCaller`, the
 * open streams one caller with a cookie may hold in the process (default 8), `perAnonymous`, the open streams of all
 * cookieless opens together (caller `""`; default 64), and `maxStreams`, the open streams of the process (default
 * 1,000). Registered under the package name at import, so `check` and `createApp({ std })` validate it.
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
