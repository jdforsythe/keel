import { ready } from "@keel/std-postgres/testing";

// One in-memory Postgres for the run: each sim ctx gets migrated, empty tables of its own.
await ready();
