import { s } from "@keel/schema";

/** The profile page's copy. */
export const ProfileText = s.object({
  heading: s.string({ min: 1 }),
  signedInAs: s.string({ min: 1 }),
  nameLabel: s.string({ min: 1 }),
  phoneLabel: s.string({ min: 1 }),
  save: s.string({ min: 1 }),
  saved: s.string({ min: 1 }),
  signOut: s.string({ min: 1 }),
  tokensHeading: s.string({ min: 1 }),
  tokensIntro: s.string({ min: 1 }),
  noTokens: s.string({ min: 1 }),
  mint: s.string({ min: 1 }),
  minted: s.string({ min: 1 }),
  expires: s.string({ min: 1 }),
  revoke: s.string({ min: 1 }),
  failed: s.string({ min: 1 }),
});
