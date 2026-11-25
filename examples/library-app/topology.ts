import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app"], adapter: "static", styles: ["@keel/ui/fonts"] },
});
