import { topology } from "@keel/server";

export default topology({ web: { modules: ["inspector"], adapter: "node", styles: ["@keel/ui/fonts"] } });
