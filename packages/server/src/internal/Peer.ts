import type { ServerApp } from "../types/ServerApp.ts";

/** Another `node` deployable as `createApp({ peers })` names it: its URL, or its app in this process. */
export type Peer = string | URL | ServerApp;
