import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";
import { setupApi } from "./setupApi.ts";

/** Sends a page to the setup form until the household has a name; it asks the household API through its service client. */
export const setUp = guard({ redirect: "setup.form" }, async (_args, ctx) => {
  const r = await setupApi.household({}, ctx);
  return r.ok && r.value.name !== null
    ? ok(null)
    : err({ code: "keel.denied", message: "set up the household first", data: null });
});
