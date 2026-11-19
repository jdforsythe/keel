import type { SurfaceEndpoint } from "./SurfaceEndpoint.ts";

/** One `service({ module })` call: its file, calling module, the module it calls, and its endpoints. */
export type SurfaceService = {
  readonly file: string;
  readonly caller: string;
  readonly module: string;
  readonly endpoints: readonly SurfaceEndpoint[];
};
