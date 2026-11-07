import { topology } from "@keel/server";

export default topology({
  web: { modules: ["recipes"], adapter: "client" },
  api: { modules: ["kitchen"], adapter: "node" },
});
