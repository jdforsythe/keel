import { s } from "@keel/schema";

/** The copy for marks that wait in the outbox or came back refused. */
export const OutboxText = s.object({
  heading: s.string(),
  waiting: s.string(),
  waitingBought: s.string(),
  waitingBack: s.string(),
  conflict: s.string(),
  gone: s.string(),
  otherMember: s.string(),
  refused: s.string(),
  goneItem: s.string(),
  mineBought: s.string(),
  mineBack: s.string(),
  theirs: s.string(),
  dismiss: s.string(),
});
