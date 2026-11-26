// The loopback certificate `@keel/testing/e2e` ships (k.e2e Answered origins): a self-signed P-256 certificate for
// `localhost`, `127.0.0.1`, `::1` and `*.peer.keel.test`, with its key. The key is published with the package and
// protects nothing: a serve's proxy ends a mapped origin's `https` with it, and only the browser contexts that serve
// opens trust it (by its key's hash). Never use it for anything a person reaches.
export const LOOPBACK_CERT = {
  cert: "-----BEGIN CERTIFICATE-----\nMIIBwDCCAWWgAwIBAgIUV5TZxybcmV3ypAgUTVArT0t9pb4wCgYIKoZIzj0EAwIw\nFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTEyNjE2MTY1MVoXDTM2MTEyMzE2\nMTY1MVowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D\nAQcDQgAE8MU+UYXo6jYIDg+KHgUVr8uV9DsNTXJV13enAU2lg61UeHqWaPmQIYyH\nQbsv8ypgSAcmwxynMFO3/Ry0K1DToKOBlDCBkTAdBgNVHQ4EFgQUqWDh7ev2PW0m\nA/Kv00+XoKnnfy0wHwYDVR0jBBgwFoAUqWDh7ev2PW0mA/Kv00+XoKnnfy0wDwYD\nVR0TAQH/BAUwAwEB/zA+BgNVHREENzA1gglsb2NhbGhvc3SCECoucGVlci5rZWVs\nLnRlc3SHBH8AAAGHEAAAAAAAAAAAAAAAAAAAAAEwCgYIKoZIzj0EAwIDSQAwRgIh\nAKn1Nvv66/qVsyxJVSI6XXJvDctDzYvte1wSPTk61xGZAiEA+ggwAP3H0t1ZufdR\nMBUAnrL0OUaXDt5yVDiRHZJPOzU=\n-----END CERTIFICATE-----",
  key: "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg+3RywXcVhCSSxxal\nxHwx2dLanEl7FzQzBk78fUK1+BuhRANCAATwxT5RhejqNggOD4oeBRWvy5X0Ow1N\nclXXd6cBTaWDrVR4epZo+ZAhjIdBuy/zKmBIBybDHKcwU7f9HLQrUNOg\n-----END PRIVATE KEY-----",
} as const;
