import { guard } from "@keel/router";
import { err, ok, s } from "@keel/schema";

const Denied = s.error("keel.denied", s.object({}));

/** Admits only the user `u1`; anyone else is sent to the sign-in page. */
export const admit = guard({ redirect: "a.signin" }, async ({ user }) =>
  user === "u1" ? ok(null) : err(Denied.make({})),
);
