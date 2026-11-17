import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import { User } from "./User.schema.ts";
import type { Users } from "./Users.schema.ts";

/** Adds the account unless its id, or its email ignoring case, is already taken; then the state is unchanged. */
export const addUser = (users: Store<Users>) =>
  transaction(users, "accounts.addUser", User, (state, payload) => {
    const email = payload.email.toLowerCase();
    const taken = state.users.some((u) => u.id === payload.id || u.email.toLowerCase() === email);
    return taken ? state : { users: [...state.users, payload] };
  });
