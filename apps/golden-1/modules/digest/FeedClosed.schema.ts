import { s } from "@keel/schema";

/** `digest.feedClosed`: the feed's wait for the next read ended because the request or the deployable closed. */
export const FeedClosed = s.error("digest.feedClosed", s.object({}));
