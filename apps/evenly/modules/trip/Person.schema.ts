import { s } from "@keel/schema";

/** One traveller: an id and the name the group knows them by. */
export const Person = s.object({
  id: s.id("Person"),
  name: s.string({ min: 1, max: 60 }),
});
