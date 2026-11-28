import { topology } from "@keel/server";

export default topology({
  web: { modules: ["app", "trip"], adapter: "client", styles: ["@keel/ui/fonts"] },
});
