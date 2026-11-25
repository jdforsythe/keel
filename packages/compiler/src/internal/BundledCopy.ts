/** What a server build copies beside `server.mjs`: `from` (absolute) to `rel`, its path under the build folder. */
export type BundledCopy = { readonly from: string; readonly rel: string };
