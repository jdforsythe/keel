/**
 * The keys `DeployEnv` of `@keel/server` parses by name (k.deploy, k.topology Build); with each `KEEL_PEER_<NAME>`,
 * the names a manifest's `env` may not hold (k.server-deps Rules E1167).
 */
export const DEPLOY_ENV_KEYS: readonly string[] = [
  "PORT",
  "HOST",
  "KEEL_SECRET",
  "KEEL_ORIGIN",
  "KEEL_DATABASE_URL",
  "KEEL_ALLOW_ORIGINS",
];
