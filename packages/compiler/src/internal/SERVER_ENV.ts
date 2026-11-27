/** `import.meta.env` of a build-time evaluation, as the server build gives it: Vite's built-in values only. */
export const SERVER_ENV: Readonly<Record<string, string | boolean>> = {
  BASE_URL: "/",
  MODE: "production",
  DEV: false,
  PROD: true,
  SSR: true,
};
