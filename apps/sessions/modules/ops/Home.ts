import { routes as sessions } from "@keel/std-sessions/routes";
import { Box, Heading, Link, Text } from "@keel/ui";

/** Home of the ingest service (`ops.home`): what it takes and where. Plain `.ts` so `node server.ts` loads it. */
export default function Home(): Node {
  return Box({
    as: "main",
    id: "ops.home",
    p: "6",
    gap: "4",
    children: () => [
      Heading({ level: 1, fontSize: "2xl", weight: "semibold", m: "0", children: "Keel sessions" }),
      Text({
        as: "p",
        id: "ops.home.intro",
        m: "0",
        children: "This service keeps recorded sessions: 64 fingerprints, the newest 5 of each, 256 KiB per session.",
      }),
      Link({ id: "ops.home.ingest", fg: "accent", to: sessions.href("sessions.ingest"), children: "Ingest endpoint" }),
    ],
  });
}
