import { topology } from "@keel/server";

export default topology({
  web: { modules: ["front"], adapter: "node", styles: ["@keel/ui/fonts"] },
  api: { modules: ["greet"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
