import { contract } from "@keel/router/contract";
export const a = contract("a", {
  "a.home": { path: "/" },
  "a.status": { path: "/status" },
  "a.boom": { path: "/boom" },
  "a.list": { path: "/list" },
  "a.replace": { path: "/replace" },
});
