// Fixture: tries the lock once and prints whether it passed.
import { acquire } from "../../mutateLock.mjs";

const r = acquire({ file: process.argv[2] });
console.log(r.held ? "passed" : `refused ${r.holder}`);
process.exit(0);
