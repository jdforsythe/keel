// A conformance test imports the package's two entries inside its own test body, so the first import (oxc-parser,
// @keel/check and its graph, transformed cold) is paid against that test's bound. This setup file imports both
// entries first, so the transform is the machine's own work, done in collection (a fixed allowance the scale does not
// shrink), and the test measures its assertions.
import "@keel/std-brands";
import "@keel/std-brands/tools";
