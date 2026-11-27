// re-exports only. Not app-facing: the surface @keel/cli and @keel/router read for the JSON Schema `pattern` of a
// blank-refusing string (`blankPattern`), @keel/compiler reads to test a declared origin's reason (`isBlank`), and @keel/server reads to keep a request's revealed secrets out of its log
// (`secretWalk`, and `onSecret` to hear of each `Secret` a request makes or reveals); @keel/check and @keel/cli fit a
// diagnostic's message to 89 units with `clipMessage` and `fitNames`.
export { secretWalk } from "./secretWalk.ts";
export { blankAbsent } from "./blankAbsent.ts";
export { blankPattern } from "./blankPattern.ts";
export { isBlank } from "./isBlank.ts";
export { onSecret } from "./onSecret.ts";
export type { SecretListener } from "./SecretListener.ts";
export { clipMessage } from "./clipMessage.ts";
export { fitNames } from "./fitNames.ts";
