import { topology } from "@keel/server";

/** One `node` deployable: the home page (`ops`) and the std-sessions ingest routes (`sessions`). */
export default topology({ sessions: { modules: ["ops", "sessions"], adapter: "node" } });
