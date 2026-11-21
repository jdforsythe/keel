import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-channels` for a serving module (k.module Std config; server-only): each bound counts the
 * streams open in the process on that module's channel routes: `perCaller`, one caller's with a cookie (default 8),
 * `perAnonymous`, all cookieless opens' together (caller `""`; default 64), and `maxStreams`, all of them (default
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
