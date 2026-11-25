# Evenly

A group trip's shared costs: who paid, who owes, and who pays whom. Evenly is Keel's walkthrough app, built one layer at a time. It runs in the browser alone, with no server, no sign-in and no user concept; each layer adds one thing a real group asks for.

Check your work, in this folder:

```sh
node ../../packages/cli/src/bin.ts check
node ../../packages/cli/src/bin.ts test
node ../../packages/cli/src/bin.ts build
```

## Layers

1. A page with no server. `modules/app/StartPage.tsx` is the start page, `dist/web` is plain files served with `csp.txt`. One minute: put a second export beside the page and read E1752.
