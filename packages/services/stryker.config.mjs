import { strykerConfig } from "../../tooling/stryker.mjs";

// conformance/fixtures/openapi holds generated files compared byte for byte; Stryker must not prepend @ts-nocheck.
export default { ...strykerConfig("services", 70), disableTypeChecks: "{src,test}/**/*.ts" };
