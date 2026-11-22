import { topology } from "@keel/server";

export default topology({
  web: { modules: ["recipes"], adapter: "client", servedBy: "api", styles: ["@keel/ui/fonts"] },
  api: { modules: ["accounts", "kitchen", "health"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
