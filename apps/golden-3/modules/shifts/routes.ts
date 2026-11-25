import { manifest } from "@keel/router";
import AppShell from "./AppShell.tsx";
import AttendPage from "./AttendPage.tsx";
import IndexPage from "./IndexPage.tsx";
import MinePage from "./MinePage.tsx";
import RosterPage from "./RosterPage.tsx";
import ShiftError from "./ShiftError.tsx";
import ShiftPage from "./ShiftPage.tsx";
import SignupPage from "./SignupPage.tsx";
import { cancel } from "./cancel.server.ts";
import { loadAttend } from "./loadAttend.server.ts";
import { loadIndex } from "./loadIndex.server.ts";
import { loadMine } from "./loadMine.server.ts";
import { loadRoster } from "./loadRoster.server.ts";
import { loadShift } from "./loadShift.server.ts";
import { loadSignup } from "./loadSignup.server.ts";
import { markAttended } from "./markAttended.server.ts";
import { organizer } from "./organizer.guard.ts";
import { shifts } from "./shifts.contract.ts";
import { signUp } from "./signUp.server.ts";

export const routes = manifest(shifts, {
  "shifts.shell": { component: AppShell },
  "shifts.index": {
    component: IndexPage,
    loader: loadIndex,
    layout: "shifts.shell",
    title: () => "Volunteer shifts · Food bank",
  },
  "shifts.show": {
    component: ShiftPage,
    loader: loadShift,
    POST: signUp,
    layout: "shifts.shell",
    errorElement: ShiftError,
    title: (p) => `${p.data.title} · Food bank`,
  },
  "shifts.mine": {
    component: MinePage,
    loader: loadMine,
    layout: "shifts.shell",
    title: () => "My sign-ups · Food bank",
  },
  "shifts.signup": {
    component: SignupPage,
    loader: loadSignup,
    POST: cancel,
    layout: "shifts.shell",
    errorElement: ShiftError,
    title: () => "Cancel sign-up · Food bank",
  },
  "shifts.roster": {
    component: RosterPage,
    loader: loadRoster,
    guard: organizer,
    layout: "shifts.shell",
    title: () => "Roster · Food bank",
  },
  "shifts.attend": {
    component: AttendPage,
    loader: loadAttend,
    POST: markAttended,
    guard: organizer,
    layout: "shifts.shell",
    title: () => "Attendance · Food bank",
  },
});
