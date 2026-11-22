import { identityMount } from "@keel/router";

/** Where the sign-in endpoints live; the sign-in page posts to `href()` under it. */
export default identityMount("/api/auth");
