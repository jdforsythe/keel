import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { Located } from "@keel/router/internal";
import type { BuiltClient } from "./BuiltClient.ts";
import type { Mode } from "./Mode.ts";
import type { Saved } from "./Saved.ts";

/**
 * A built deployable: its routes, `ctx`, mode, its manifest (guard redirects resolve in it, RFC 0041), the action body cap in bytes, the extra origins the dev
 * inspect endpoint answers, and the in-process copy of each `ctx.storage` key a `stores` factory's store was restored
 * from or saved to (`openStores`, `saveStores`; k.server Server state). `built` is the production client build
 * (`createApp({ assets })`, k.server Build), undefined in dev or without `assets`.
 */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly maxBody: number;
  readonly inspectOrigins: readonly string[];
  readonly saved: Map<string, Saved>;
  readonly built: BuiltClient | undefined;
};
