import { s } from "@keel/schema";

export const TokenExpiryRefused = s.error("members.expiry", s.object({}));
