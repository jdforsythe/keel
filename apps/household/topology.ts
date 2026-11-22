import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app", "members", "receipts", "setup", "shopping"], adapter: "node" },
});
