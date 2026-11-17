import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Nothing } from "../api/Nothing.schema.ts";
import { RecountInput } from "./RecountInput.schema.ts";
import { jobs } from "./jobs.server.ts";

/** `POST /digest/refresh`: enqueue one `digest.recount`; `GET /digest` shows its count once it has run. */
export const refresh = action({ input: RecountInput, output: Nothing }, async (input, _args, ctx) => {
  const r = await jobs.enqueue(ctx, "digest.recount", input);
  return r.ok ? ok({}) : err(r.error);
});
