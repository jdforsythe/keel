import { topology } from "@keel/server";

export default topology({
  web: { modules: ["shifts", "sessions"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
