import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["app"],
    adapter: "client",
    styles: ["@keel/ui/fonts"],
    origins: { connect: { "https://api.github.com": "the release list on the releases page" } },
  },
});
