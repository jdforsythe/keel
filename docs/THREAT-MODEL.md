# Threat model (seed)

Assets: user data in stores and logs; secrets in server env; session files. Adversaries: web attackers (XSS, CSRF, injection), malicious dependencies, agents reaching for `unsafe`. Kernel commitments: escaped output by default; `Secret<T>` cannot serialize or log; `.server.ts` cannot reach the client; parameterized queries only (stdlib db); `unsafe.*` justified and counted. Grows per package.
