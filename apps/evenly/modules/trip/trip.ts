import { invariant, store } from "@keel/store";
import { Trip } from "./Trip.schema.ts";

export const trip = store(Trip, { people: [], costs: [] }, { id: "trip.trip" });

invariant(trip, (t) => new Set(t.people.map((p) => p.id)).size === t.people.length);
invariant(trip, (t) => new Set(t.costs.map((c) => c.id)).size === t.costs.length);
invariant(trip, (t) => t.costs.every((c) => t.people.some((p) => p.id === c.payer)));
invariant(trip, (t) => t.costs.every((c) => c.shares.every((sh) => t.people.some((p) => p.id === sh.person))));
