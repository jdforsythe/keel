import { identityMount } from "@keel/router";

/** Where the sign-in library's endpoints live; the sign-in, sign-up and sign-out forms post under it. */
export default identityMount("/api/auth");
