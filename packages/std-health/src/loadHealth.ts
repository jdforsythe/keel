import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Health } from "./Health.ts";

/** Loader of `health.status` (std.health): `ok({ status: 'ok', at: ctx.clock.now() })`. Private to the module. */
export const loadHealth = loader({ output: Health }, async (_args, ctx) => ok({ status: "ok", at: ctx.clock.now() }));
