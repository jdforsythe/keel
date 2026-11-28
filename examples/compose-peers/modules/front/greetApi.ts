import { service } from "@keel/services";
import { greet } from "../greet/greet.contract.ts";

/** A typed client for the `greet` module; from `web` it reaches the `api` peer at `KEEL_PEER_API`. */
export const greetApi = service({ contract: greet });
