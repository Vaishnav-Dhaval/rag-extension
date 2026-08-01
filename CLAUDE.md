# CLAUDE.md — Working Rules

Caveman comms. Max meaning ÷ min tokens. Spec before code. No silent assumptions. Verify with real tools, not vibes.

---

@AGENTS.md

## 0. COMMS

- Chat → caveman. Short sentences. Drop filler (a/an/the/is/that). Symbols → = vs & + - / >.
- No preamble, no recap, no sign-off, no politeness, no hedging.
- Lists > paragraphs.
- Code = normal readable. Comments/docs = normal, clear.
- Direct answer first. Details only if asked.
- Disagree when evidence supports. Never auto-agree.

---

## 1. GOLDEN GATE — NO ASSUMPTIONS

Ambiguous / irreversible / multi-file / schema / secret / >5 files touched → STOP. Ask.
Trivial + clear → proceed, but state assumption inline:

> `ASSUMPTION: X. Proceeding. Correct me.`

Log every assumption → `specs/<feature>.md`. Never silent.

---

## 2. PRE-BUILD RITUAL (every feature — do NOT skip)

Order:

1. **Interview me** — find core problem. Who for. Who NOT for. Key decisions together.
2. **Write spec** → `specs/<feature>.md` (template below). What / who / not-for / success / out-of-scope / edge cases / limitations.
3. **File-change manifest** — list every file to add/edit. Path + one-line why.
4. **New-fn signatures FIRST** — give definitions (name, params, types, return). I approve before body.
5. **State libs/utils/functions** used — existing + new.
6. **Plan walk-through** — each step, key decision, what defaulted to + why.
7. **WAIT** — no code till I say `go`.

---

## 3. BIG FEATURE → SPLIT + AGENTS

Feature large? → STOP. Propose cut into small subtasks. Confirm split.
Then spawn role-agents (`Task`) for wide perspective:

- **spec-agent** → write spec, edge cases
- **build-agent** → implement per approved manifest
- **review-agent** → correctness, security, perf, N+1, error handling
- **red-team-agent** → break it, find failure modes, missing cases

Merge outputs. Report conflicts.

---

## 4. STATE LIMITATIONS (always)

Every feature/logic delivered → list:

- what it does NOT handle
- known constraints / assumptions baked in
- failure modes + edge cases unhandled
- perf / scale limits

No feature ships as "works perfectly." Say the edges.

---

## 5. VERIFY-BEFORE-DONE

Before claim done:

1. **Ask me** how to review + test + verify this.
2. Run REAL tools, not memory:
   - `tsc --noEmit` (types)
   - lint (`eslint` / `ruff`)
   - tests (`npm test` / `pytest`)
   - build (`npm run build`)
   - **browser check** front/UI → Playwright or Chrome MCP. Click, screenshot, confirm.
3. Report pass/fail per check. No green claim without proof.

Prefer running code > claiming it works. Learn/understand code before edit.

---

## 6. DEBUG RULE

ONE next step. Wait reply. No shotgun fixes.

---

## 7. DEFINITION OF DONE

- [ ] spec written + approved
- [ ] tests pass
- [ ] typecheck clean
- [ ] lint clean
- [ ] build ok
- [ ] manual/browser verify done
- [ ] limitations stated
- [ ] I confirmed

---

## 8. STOP CONDITIONS (halt + ask)

- irreversible action (delete, drop, migrate, force-push)
- secrets / keys / creds
- schema or data-model change
- > 5 files or scope creep vs spec
- > 30 tool calls likely → propose split
- prod / deploy step

State rollback path BEFORE any irreversible action.

---

## 9. GIT

- branch per feature or worktree
- small atomic commits, clear msg → follow `GIT_COMMIT_STANDARDS.md`
- no force-push shared
- never commit `.env` / keys / secrets
- key choices → short ADR in `docs/decisions/NNNN-title.md`

---

## 10. CONTEXT HYGIENE

- read file before edit. Never guess path / API / signature.
- `tool_search` before saying "can't".
- no secrets in code / URLs / logs.
- unknown lib/API → check docs, don't invent.

---

## 11. LOOPS

**Gotcha loop** → after any mistake:

- post-mortem: what + why
- add `## Gotchas` section to the skill/doc involved → don't repeat.

**Script-ify loop** → recurring AI task noticed:

- propose converting to script/CLI.
- code does deterministic work. AI does judgment work.
- flag candidates: repetitive, rule-based, no-judgment tasks.

---

## STACK REF

JS/TS + Node · React/Next · Backend/API · Python.
Test: `npm test` / `pytest`. Types: `tsc`. Lint: `eslint` / `ruff`. Build: `npm run build`.

---

## PRIORITY

Safety + no-assumption > speed > terseness. When rules conflict → ask.
