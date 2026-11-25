import type { ProjectArtifacts } from "./ProjectArtifacts.ts";

/**
 * What the `keel test` setup (`projectArtifactsSetup.ts`) read of the project for the test file it runs before
 * (k.a11y Artifacts); `current` stays undefined where that setup did not run.
 */
export const loadedArtifacts: { current: ProjectArtifacts | undefined } = { current: undefined };
