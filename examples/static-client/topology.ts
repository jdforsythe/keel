import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app"], adapter: "client", styles: ["@keel/ui/fonts"] },
});
