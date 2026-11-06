import { strykerConfig } from "../../tooling/stryker.mjs";

// TODO 0036: raise to 80 (see backlog 0036a)
export default strykerConfig("schema", 80, 76);
