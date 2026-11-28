import { s } from "@keel/schema";
import { Slug } from "@keel/std-text";
import { OutboxText } from "./OutboxText.schema.ts";

const Staple = s.object({ key: Slug, text: s.string({ min: 1 }) });

export const ListText = s.object({
  heading: s.string({ min: 1 }),
  addStaple: s.string({ min: 1 }),
  staples: s.array(Staple),
  views: s.string({ min: 1 }),
  toBuy: s.string({ min: 1 }),
  bought: s.string({ min: 1 }),
  markBought: s.string({ min: 1 }),
  putBack: s.string({ min: 1 }),
  remove: s.string({ min: 1 }),
  empty: s.string({ min: 1 }),
  help: s.string({ min: 1 }),
  helpBody: s.string({ min: 1 }),
  failed: s.string({ min: 1 }),
  dismiss: s.string({ min: 1 }),
  outbox: OutboxText,
  live: s.object({
    live: s.string({ min: 1 }),
    connecting: s.string({ min: 1 }),
    offline: s.string({ min: 1 }),
    denied: s.string({ min: 1 }),
  }),
});
