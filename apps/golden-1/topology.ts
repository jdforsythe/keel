import { topology } from "@keel/server";

export default topology({
  web: { modules: ["todos"], adapter: "client" },
  api: { modules: ["api", "digest"], adapter: "node" },
});
