import { topology } from "@keel/server";

export default topology({
  web: { modules: ["recipes"], adapter: "client", host: "api" },
  api: { modules: ["kitchen"], adapter: "node" },
});
