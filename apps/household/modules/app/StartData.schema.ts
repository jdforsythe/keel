import { s } from "@keel/schema";

export const StartData = s.object({
  heading: s.string(),
  intro: s.string(),
  toList: s.string(),
  toReceipts: s.string(),
});
