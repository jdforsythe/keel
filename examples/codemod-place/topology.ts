import { topology } from "@keel/server";

export default topology({
  web: { modules: ["shop", "stock"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
