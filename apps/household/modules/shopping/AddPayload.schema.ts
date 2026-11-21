import { s } from "@keel/schema";

export const AddPayload = s.object({ id: s.id("Item"), name: s.string({ min: 1, max: 60 }) });
