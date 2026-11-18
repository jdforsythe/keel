import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import { Profile } from "./Profile.schema.ts";
import type { Profiles } from "./Profiles.schema.ts";

/** Keeps the latest email a user signed in with: one profile per user id. */
export const saveProfile = (profiles: Store<Profiles>) =>
  transaction(profiles, "accounts.saveProfile", Profile, (state, payload) => ({
    profiles: [...state.profiles.filter((p) => p.userId !== payload.userId), payload],
  }));
