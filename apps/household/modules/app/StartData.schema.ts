import { s } from "@keel/schema";

export const StartData = s.object({
  heading: s.string({ min: 1 }),
  intro: s.string({ min: 1 }),
  toList: s.string({ min: 1 }),
  toReceipts: s.string({ min: 1 }),
  toSetup: s.string({ min: 1 }),
  toProfile: s.string({ min: 1 }),
});
