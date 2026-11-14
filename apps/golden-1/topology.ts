import { topology } from "@keel/server";

export default topology({
  web: { modules: ["todos"], adapter: "client", host: "api" },
  api: { modules: ["api", "digest", "sessions"], adapter: "node", storage: "sqlite" },
});
