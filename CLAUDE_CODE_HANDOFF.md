# Project Hail Mary — Claude Code Handoff Brief

Paste this entire message to Claude Code when you first run it in the phm folder.

---

I have a personal productivity web app called "Project Hail Mary" running as an installed Mac PWA.
The app is a single HTML file at /Users/tommie/Desktop/phm/index.html served by a Python
http.server on port 5173 via a LaunchAgent that auto-starts on login.

## What the app does (all working)
- Journal tab: date wheel (year/month/day), entries save as .docx to Google Drive in real time
  Path: Project Hail Mary/journal/YYYY/YYYYmm_monthname/YYYYmmdd.docx
- Projects tab: create projects with subtasks, progress bars, file attachments, updates log
  Path: Project Hail Mary/projects/phm-projects.json
- Home tab: Bible verse of the day, day counter from 19 Jan 1998, today's entry preview, active projects
- Media tab: audio player using HTML <audio>, streams from Drive, auto-counts plays past 90%,
  manual tap counters (Rosary etc), IndexedDB offline cache
  Path: Project Hail Mary/media/ (MP3 files) + phm-media.json (counts)
- Menu tab: Google Drive connect button, calendar, import/export, security, categories

## Google Drive integration
- OAuth Client ID: 651548279771-86rvs7k45o763e67vd54gsij4q5e17eq.apps.googleusercontent.com
- Scope: https://www.googleapis.com/auth/drive
- Auth: Google Identity Services (GIS) token client, manual connect button in Menu
- All data in "Project Hail Mary" folder in user's Google Drive
- Storage layer: store.saveEntry(), store.loadEntries(), store.saveProjects() etc
- Journal entries are indexed as metadata only (yyyymmdd + fileId) via store.buildEntryIndex()
  Content is fetched on demand via store.fetchEntry(dk)
- Entry index persisted in localStorage['phm-entry-index']

## Data architecture (offline-first, multi-device)
- `mem{}` is the in-memory cache — always the runtime source of truth
- On every page load, mem is bootstrapped from localStorage BEFORE Drive connects:
  - localStorage['phm-projects'] → mem.projects
  - localStorage['phm-media']    → mem.media
  - localStorage['phm-settings'] → mem.settings
  - localStorage['phm-entry-index'] → S.entryIndex (string fileId per date)
  - localStorage['phm-e-YYYYMMDD'] → mem['e:YYYYMMDD'] (cached entry content)
- This means the app shows correct data INSTANTLY on open, before Drive connects
- When Drive connects, data is MERGED (not replaced):
  - Projects: higher updatedAt wins (_mergeProjects)
  - Media counts: higher count/autoCount always wins (_mergeMedia)
  - Settings: Drive always wins
- After merging, localStorage is updated so it stays current
- A 60-second background poll (_pollDriveChanges) checks Drive file modifiedTimes
  and pulls changes from other devices, showing "↻ Updated" briefly in the status bar
- File IDs for the poll are cached in _syncFileIds; timestamps in _lastLoaded

## Security
- Password lock screen (keyboard input + Enter key)
- WebAuthn Touch ID / Face ID using navigator.credentials.get/create
- Credentials stored as an ARRAY: S.settings.credentialIds[] — each device registers its own
  (each device must register independently via Menu → Security → Set up Face ID / Touch ID)
- Legacy single S.settings.credentialId is still supported as a fallback
- Auto-lock on idle and on visibility change
- Settings saved to phm.config.json in Drive + localStorage['phm-settings']

## Journal loading (two-phase)
- Phase 1 (on every Drive connect): store.buildEntryIndex() — metadata only, fast
  Saves to localStorage['phm-entry-index'] with timestamp
- Phase 2 (background): _preloadRecentEntries() — last 30 days, batches of 3
  Content fetched on demand via store.fetchEntry(dk)
- LRU cache: max 200 entries in mem (evicts oldest by ts)
- _triedFetch{} prevents re-fetch loops on empty/failed entries
- openEditor(), openDay(), updatePrev() all fetch on demand if entry is in index but not mem

## File structure
/Users/tommie/Desktop/phm/
  index.html      ← entire app (single file, ~130KB)
  manifest.json   ← PWA manifest
  sw.js           ← service worker: network-first for HTML, cache-first for assets
  icon-192.png    ← app icon
  icon-512.png    ← app icon
  com.projecthailmary.server.plist ← LaunchAgent (already installed)
  start.command   ← double-click to open app

## Service worker strategy (sw.js)
- HTML navigation: network-first (always fetch from Netlify, fall back to cache)
  This ensures Netlify deploys are picked up automatically on mobile
- Static assets (icons, manifest): cache-first
- Google API calls: always network, never cached
- Cache name: 'phm-v3' — increment version to force cache bust

## Key state variables
- `mem{}` — in-memory cache, source of truth
- `S{}` — runtime state built from mem via refresh()
  S.entries, S.entryIndex, S.projects, S.tracks, S.counters, S.settings
- `_driveReady` — Drive connected and folders found
- `_driveConnecting` — token request in flight
- `_lastLoaded` — {projects, media, settings} timestamps for poll
- `_syncFileIds` — {projects, media, settings} Drive file IDs for poll
- `_driveOperationInProgress` / `_driveOpCount` — prevents idle-lock during Drive ops
- `_triedFetch{}` — marks dates where fetch was attempted (prevents loops)
- `S.entryIndex` — {yyyymmdd: fileId (string)} metadata for all journal dates
  ('local' is the placeholder value for new entries not yet synced; backward-compat: old {id,docx} objects are handled in fetchEntry)

## What needs to be added (in priority order)

### 1. Bible Brain API — Malayalam audio Bible reading plan
- API key will be provided when ready
- Need: 365-day reading plan dividing all 1189 Bible chapters into daily readings
- Start date is user-configurable (not fixed to Jan 1)
- Each day: play the assigned chapters in Malayalam audio from Bible Brain API
- Track which days have been listened to (save to Drive)
- Auto-advances to next day's reading each day regardless of completion
- Bible Brain Malayalam fileset to discover: query /bibles/filesets?language_code=mal&type=audio_drama
- API base URL: https://4.dbt.io/api/
- Add as a new "Bible" tab in the bottom nav

### 2. Background alarm (Mac)
- A simple daily alarm time the user sets in the app
- When triggered: plays a gentle sound and shows a notification
- On Mac PWA this can use the Notifications API + a service worker scheduled check
- NOTE: true background alarm when app is fully closed needs a native app (phase 2)

### 3. Journal export — per-day files
- Export should offer per-day .docx files (as a zip) in addition to the combined export
- Note: with two-phase loading, only loaded entries are in mem; a full export needs to
  fetch all entries from Drive first (could be slow for 950+ entries)

## Architecture notes
- Everything is vanilla JS, no frameworks, no build step needed
- The storage layer (store.* functions) is the only place that touches Drive
- To add a new tab: add to items[] in renderShell(), add a render function, add a route
- Categories are stored in S.settings.cats[] and saved to phm.config.json
- Do not change the Drive folder structure — user has 5+ years of journal data there
- Do not change the .docx save format for journal entries
- Keep changes minimal — only modify what's needed for the task

## How to run / test
cd /Users/tommie/Desktop/phm
python3 -m http.server 5173
# then open http://localhost:5173 in Brave browser
# Google account: jeanjosets@gmail.com

The LaunchAgent already handles auto-start, so the server may already be running.
Check with: lsof -i :5173
