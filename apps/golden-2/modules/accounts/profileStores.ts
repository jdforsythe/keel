import { invariant, store } from "@keel/store";
import { Profiles } from "./Profiles.schema.ts";
import { saveProfile } from "./saveProfile.ts";

/** The signed-in users' profiles, restored from `ctx.storage` per request; the identity source writes them. */
export const profileStores = () => {
  const profiles = store(Profiles, { profiles: [] }, { id: "accounts.profiles" });
  invariant(profiles, (state) => new Set(state.profiles.map((p) => p.userId)).size === state.profiles.length);
  return { profiles, saveProfile: saveProfile(profiles) };
};
