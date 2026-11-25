import { s } from "@keel/schema";
import { Person } from "./Person.schema.ts";

/** The payload of `trip.addPerson`: the person, with an id the caller minted from `ctx.random`. */
export const AddPersonPayload = s.object({ person: Person });
