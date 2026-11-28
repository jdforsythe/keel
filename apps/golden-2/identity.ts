import { identityMount } from "@keel/router";

/** Where the sign-in library's endpoints live; the account pages post to `href()` under it. */
export default identityMount("/api/auth");
