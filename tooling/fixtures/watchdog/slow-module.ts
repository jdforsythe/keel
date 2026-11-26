// A module whose import holds the thread for 2.5 s: the machine's own work on a cold file, a wall-clock wait.
const until = performance.now() + 2500;
while (performance.now() < until) {}
