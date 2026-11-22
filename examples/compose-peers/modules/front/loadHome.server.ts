import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Home } from "./Home.schema.ts";
import { front } from "./front.contract.ts";
import { greetApi } from "./greetApi.ts";

/** Asks the `api` peer for a greeting on behalf of this request's user; the peer runs no `identify` of its own. */
export const loadHome = loader(front, "front.home", { output: Home }, async ({ user }, ctx) => {
  const r = await greetApi.hello({ user }, ctx);
  return ok({ greeting: r.ok ? r.value.text : r.error.code });
});
