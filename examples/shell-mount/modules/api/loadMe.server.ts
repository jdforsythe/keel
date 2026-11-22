import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { api } from "./api.contract.ts";

/** GET `/api/me`: the signed-in user's name, else 403 `keel.denied`. */
export const loadMe = loader(api, "api.me", {}, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok({ name: user }),
);
