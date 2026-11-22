import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["places"],
    adapter: "client",
    styles: ["@keel/ui/fonts"],
    shells: { tauri: { id: "dev.keel.linksin", name: "Links in" } },
  },
});
