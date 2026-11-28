A small built app `@keel/testing`'s own tests run `keel test --e2e` over (`test/e2eHeldStatic.test.ts`): one `static`
deployable whose tokens declare a `choice` theme, so each document's head loads the scheme script the parser waits for,
and a page with one island. It is copied to a temporary folder for each run.
