import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["notes"],
    adapter: "client",
    servedBy: "api",
    styles: ["@keel/ui/fonts"],
    shells: { tauri: { id: "dev.keel.shellmount", name: "Shell mount" } },
  },
  api: { modules: ["api"], adapter: "node", styles: ["@keel/ui/fonts"] },
});
