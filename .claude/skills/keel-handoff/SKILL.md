---
name: keel-handoff
description: Checkpoint and hand off work so a fresh agent resumes in one read.
---
# Handoff

1. Update `tasks/<id>/PLAN.md`: tick done steps; write the literal next action; list files touched; paste test trailer; record open questions.
2. `git add -A && git commit -m "wip(<id>): <step>"`.
3. Update `docs/HANDOFF.md` active entry: branch, worktree, next, blockers, pending decisions, commit sha.
4. Print one line: `resume: /resume (task <id>, next: <action>)`.
Never summarize from memory what the repo already states.
