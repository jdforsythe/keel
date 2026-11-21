import { channel } from "@keel/std-channels";
import { Nothing } from "./Nothing.schema.ts";

/**
 * The board's channel: `GET /api/board/events` tells every open page that `api.board` was saved, so it re-reads. It
 * declares no message, so nothing is published on it.
 */
export const boardChannel = channel("api.board", { path: "/api/board/events", params: Nothing });
