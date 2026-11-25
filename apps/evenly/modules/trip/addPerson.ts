import { transaction } from "@keel/store";
import { AddPersonPayload } from "./AddPersonPayload.schema.ts";
import { trip } from "./trip.ts";

export const addPerson = transaction(trip, "trip.addPerson", AddPersonPayload, (t, p) =>
  t.people.some((q) => q.id === p.person.id) ? t : { ...t, people: [...t.people, p.person] },
);
