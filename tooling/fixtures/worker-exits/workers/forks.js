// Stands in for vitest's fork worker (`workers/forks.js`) in test/worker-crash.test.ts: it stays alive on its IPC
// channel until the test kills it.
process.on("message", () => {});
