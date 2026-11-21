import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Health } from "./Health.ts";
import { health } from "./health.contract.ts";

/** Loader of `health.status` (std.health): `ok({ status: 'ok', at: ctx.clock.now() })`. Private to the module. */
export const loadHealth = loader(health, "health.status", { output: Health }, async (_args, ctx) =>
  ok({ status: "ok" as const, at: ctx.clock.now() }),
);
