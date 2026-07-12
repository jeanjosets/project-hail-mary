## Ground Rules for This Project
- The person you're working with is non-technical. Always explain any
  required manual step (Google Console, Vercel, terminal commands) in
  plain, simple language — assume no coding background.
- Before changing or creating any file: show a short plain-language
  summary of what will be touched and why, and wait for explicit
  confirmation before proceeding.
- Before modifying index.html: always create a backup copy first
  (index.backupN.html, incrementing from whatever the highest existing
  number is).
- Make minimal, scoped changes. Do not refactor or "clean up" unrelated
  code while working on a specific feature or fix, unless explicitly
  asked.
- Never touch: PIN lock, WebAuthn, orientation lock, pull-to-refresh
  disable, media player core logic, or Google Drive auth code — unless
  a task explicitly names that area.
- Current phase: LOCAL-ONLY. Do not add, modify, or build on top of any
  Google Drive / Google Sign-In code right now. All new data must be
  saved via IndexedDB, following the existing pattern used for the
  offline audio player. Drive integration resumes in a later phase.
- Prefer lightweight, simple implementations over clever or
  heavy-dependency ones — this app must stay fast and low-crash on an
  older Android phone.
- Keep new features modular — separated, easy to test and roll back
  individually, not tangled into unrelated functions.
- When a task is done, report back in plain language: what changed,
  what was tested, and anything that still needs attention.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
