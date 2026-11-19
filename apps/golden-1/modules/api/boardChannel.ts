import { s } from "@keel/schema";
import { channel } from "@keel/std-channels";

/**
 * The board's channel: `GET /api/board/events` tells every open page that `api.board` was saved, so it re-reads. It
 * declares no message, so nothing is published on it.
 */
export const boardChannel = channel("api.board", { path: "/api/board/events", params: s.object({}) });
