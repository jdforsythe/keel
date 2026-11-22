import { topology } from "@keel/server";

export default topology({
  web: { modules: ["recipes"], adapter: "client", servedBy: "api" },
  api: { modules: ["accounts", "kitchen", "health", "sessions"], adapter: "node" },
});
