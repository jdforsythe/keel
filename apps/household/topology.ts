import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app", "receipts", "shopping"], adapter: "node" },
});
