/**
 * What a case that runs `check` in process bounds: the TypeScript programs it builds, three in the slowest cases (a
 * fix applied and the tree checked again, a stdlib module beside an app module). A program takes about 1 s here on a
 * quiet machine and up to 3 s beside other work. The bound is 120 s a program, so at scale 0.1 (the local gate and CI)
 * a program has 12 s and a three-program case 36 s. A case passes it to vitest, which scales it by
 * `KEEL_TEST_TIME_SCALE`.
 */
export const CHECK_CASE_BOUND = 3 * 120_000;
