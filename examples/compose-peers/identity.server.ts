import { identity } from "@keel/server";

// A stand-in for an auth proxy, so the example runs alone: the proxy in front of `web` signs the person in and sets
// `x-forwarded-user`. Trust such a header only when the deployable is reachable through that proxy alone (keel-deploy).
// A real app hands `identify` to its auth library (keel-server, Identity).
export default identity({
  identify: ({ request }) => Promise.resolve(request.headers.get("x-forwarded-user") ?? ""),
});
