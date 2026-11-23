import { s } from "@keel/schema";

/** The copy every page's frame shows: the app's name, the navigation, and the note on what the page records. */
export const ShellText = s.object({
  app: s.string({ min: 1 }),
  nav: s.string({ min: 1 }),
  list: s.string({ min: 1 }),
  receipts: s.string({ min: 1 }),
  setup: s.string({ min: 1 }),
  profile: s.string({ min: 1 }),
  signOut: s.string({ min: 1 }),
  signIn: s.string({ min: 1 }),
  signUp: s.string({ min: 1 }),
  recording: s.string({ min: 1 }),
  recordingBody: s.string({ min: 1 }),
  recorded: s.string({ min: 1 }),
});
