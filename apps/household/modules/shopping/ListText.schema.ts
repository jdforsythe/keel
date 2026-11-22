import { s } from "@keel/schema";

const Staple = s.object({ key: s.string({ min: 1, max: 64 }), text: s.string({ min: 1 }) });

export const ListText = s.object({
  heading: s.string(),
  addStaple: s.string(),
  staples: s.array(Staple),
  views: s.string(),
  toBuy: s.string(),
  bought: s.string(),
  markBought: s.string(),
  putBack: s.string(),
  remove: s.string(),
  empty: s.string(),
  help: s.string(),
  helpBody: s.string(),
  failed: s.string(),
  dismiss: s.string(),
  live: s.object({ live: s.string(), connecting: s.string(), offline: s.string(), denied: s.string() }),
});
