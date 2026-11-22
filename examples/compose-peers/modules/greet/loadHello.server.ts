import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { greet } from "./greet.contract.ts";

/** GET `/api/hello`: a greeting for the request's user, else 403 `keel.denied`. */
export const loadHello = loader(greet, "greet.hello", {}, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok({ text: `Hello, ${user}` }),
);
