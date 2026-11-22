import { s } from "@keel/schema";

/** The copy every page's masthead shows: the app's name and the navigation. */
export const ShellText = s.object({
  app: s.string({ min: 1 }),
  nav: s.string({ min: 1 }),
  list: s.string({ min: 1 }),
  receipts: s.string({ min: 1 }),
  profile: s.string({ min: 1 }),
  signOut: s.string({ min: 1 }),
  signIn: s.string({ min: 1 }),
  signUp: s.string({ min: 1 }),
});
