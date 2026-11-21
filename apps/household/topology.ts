import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app", "shopping"], adapter: "node" },
});
