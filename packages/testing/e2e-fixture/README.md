A small built app `@keel/testing`'s own tests run `keel test --e2e` over (`test/e2eRun.test.ts`): one `node` deployable,
a store with one action, a page that never changes, a click handler that rejects, an input in an island, and an island
whose claim differs from the server's render. It is copied to a temporary folder for each run.
