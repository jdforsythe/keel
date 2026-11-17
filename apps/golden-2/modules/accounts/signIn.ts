import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import { Session } from "./Session.schema.ts";
import type { Sessions } from "./Sessions.schema.ts";

/** Ties the caller to the account: one session per caller, the latest sign-in wins. */
export const signIn = (sessions: Store<Sessions>) =>
  transaction(sessions, "accounts.signIn", Session, (state, payload) => ({
    sessions: [...state.sessions.filter((x) => x.caller !== payload.caller), payload],
  }));
