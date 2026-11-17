import { invariant, store } from "@keel/store";
import { ApiTokens } from "./ApiTokens.schema.ts";
import { Sessions } from "./Sessions.schema.ts";
import { Users } from "./Users.schema.ts";
import { addToken } from "./addToken.ts";
import { addUser } from "./addUser.ts";
import { setPassword } from "./setPassword.ts";
import { signIn } from "./signIn.ts";

/** The accounts, the signed-in callers and the API tokens, restored from `ctx.storage` per request. */
export const accountStores = () => {
  const users = store(Users, { users: [] }, { id: "accounts.users" });
  invariant(
    users,
    (state) =>
      new Set(state.users.map((u) => u.id)).size === state.users.length &&
      new Set(state.users.map((u) => u.email.toLowerCase())).size === state.users.length,
  );
  const sessions = store(Sessions, { sessions: [] }, { id: "accounts.sessions" });
  invariant(sessions, (state) => new Set(state.sessions.map((x) => x.caller)).size === state.sessions.length);
  const tokens = store(ApiTokens, { tokens: [] }, { id: "accounts.tokens" });
  invariant(tokens, (state) => new Set(state.tokens.map((t) => t.id)).size === state.tokens.length);
  return {
    users,
    sessions,
    tokens,
    addUser: addUser(users),
    setPassword: setPassword(users),
    signIn: signIn(sessions),
    addToken: addToken(tokens),
  };
};
