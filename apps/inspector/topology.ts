import { topology } from "@keel/server";

export default topology({ web: { modules: ["inspector"], adapter: "client", styles: ["@keel/ui/fonts"] } });
