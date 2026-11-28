import { s } from "@keel/schema";

/** The copy for marks that wait in the outbox or came back refused. */
export const OutboxText = s.object({
  heading: s.string({ min: 1 }),
  waiting: s.string({ min: 1 }),
  waitingBought: s.string({ min: 1 }),
  waitingBack: s.string({ min: 1 }),
  conflict: s.string({ min: 1 }),
  gone: s.string({ min: 1 }),
  otherMember: s.string({ min: 1 }),
  refused: s.string({ min: 1 }),
  goneItem: s.string({ min: 1 }),
  mineBought: s.string({ min: 1 }),
  mineBack: s.string({ min: 1 }),
  theirs: s.string({ min: 1 }),
  dismiss: s.string({ min: 1 }),
});
