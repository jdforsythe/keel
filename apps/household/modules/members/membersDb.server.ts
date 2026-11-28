import { database } from "@keel/std-postgres/server";

/** The members' database: the `members` and `api_tokens` tables, made by `modules/members/migrations/*.sql`. */
export const membersDb = database("members.db");
