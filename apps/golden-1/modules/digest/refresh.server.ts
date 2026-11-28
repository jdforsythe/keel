import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { digest } from "./digest.contract.ts";
import { jobs } from "./jobs.server.ts";

/** `POST /digest/refresh`: enqueue one `digest.recount`; `GET /digest` shows its count once it has run. */
export const refresh = action(digest, "digest.refresh", {}, async (input, _args, ctx) => {
  const r = await jobs.enqueue(ctx, "digest.recount", input);
  return r.ok ? ok({}) : err(r.error);
});
