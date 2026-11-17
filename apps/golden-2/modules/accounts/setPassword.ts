import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import { PasswordChange } from "./PasswordChange.schema.ts";
import type { Users } from "./Users.schema.ts";

/** Replaces one account's password hash; an unknown id leaves the state unchanged. */
export const setPassword = (users: Store<Users>) =>
  transaction(users, "accounts.setPassword", PasswordChange, (state, payload) => ({
    users: state.users.map((u) => (u.id === payload.userId ? { ...u, password: payload.password } : u)),
  }));
