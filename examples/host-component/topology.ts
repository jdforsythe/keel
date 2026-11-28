import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
