import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";
import { isOrganizer } from "./isOrganizer.ts";

/** Admits an organizer; anyone else goes to the shift list. Runs on the server, so the list never reaches a browser. */
export const organizer = guard({ redirect: "shifts.index" }, async ({ caller }, ctx) =>
  (await isOrganizer(ctx, caller)) ? ok(null) : err({ code: "keel.denied", message: "organizers only", data: null }),
);
