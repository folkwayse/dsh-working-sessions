<div align="center">

# dsh-working-sessions

**A "Working" group for the DeepSeek Harness sidebar — sessions that are genuinely active float to the top.**

[![Release](https://img.shields.io/github/v/release/folkwayse/dsh-working-sessions?style=flat-square)](https://github.com/folkwayse/dsh-working-sessions/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-DSH%20Web%20%2F%20Desktop-4D6BFE.svg?style=flat-square)](https://github.com/deepseek-ai)

</div>

---

While juggling a dozen sessions, the ones actually running get buried under
idle history. This plugin adds a compact **Working** section above the
workspace list, showing only sessions that are *right now* producing work —
click one to jump straight into its conversation.

```
● Working
  ◌  Refactor auth middleware          ← spinner = actively running
  ◌  Fix flaky e2e test
─────────────────────────────────
Workspaces
  📁 project-a
  📁 project-b
  ...
```

## Features

- **Live truth, not stale flags** — reads the client's live
  `sessionStatus` snapshot first; the summary's `running` flag is only a
  fallback. Sessions stuck with a zombie `running=true` (crashed host,
  interrupted turn) are filtered out.
- **Subagent aware** — a parent session with active subagents counts as
  working even if its own turn is idle.
- **10-minute freshness guard** — a session whose last event is older than
  10 minutes is never listed, no matter what the flags claim.
- **Click to open** — rows call `ctx.uiWorkspace.openSession(id)`, the same
  navigation action the native sidebar uses.
- **Native look** — section label matches the sidebar's "Workspaces" style;
  rows use a green spinner, hover highlight, ellipsised titles. No boxed
  banner, no count badge.
- **Self-erasing** — when nothing is running, the entire group disappears.
- **Safe shadowing** — the original `WorkspaceBrowser` renders untouched
  below; a class-based error boundary means a plugin crash can never take
  the sidebar down with it.

## Install

From a release tarball:

```bash
dsh plugin install dsh-working-sessions-0.1.0.tgz
```

Or link it into your DSH profile's `package.json` bundles:

```json
{
  "dependencies": {
    "dsh-working-sessions": "link:../dsh-working-sessions"
  },
  "bundles": ["dsh-working-sessions"]
}
```

Restart the Harness (or reload the web profile) and the group appears
whenever a session starts working.

## How it works

The plugin shadows the `sidebar.workspaces` slot with a lower priority
(`-10`), which wins the "lowest renders" shadowing rule of the Cordis slot
system. It then copies the original entry's `children`, `store`, `inject`,
and `locale` **by reference**, so the native browser's child slots (session
menus, row actions, hover cards) stay authorized and fully functional inside
the wrapper.

Data comes from the root standard hooks:

```js
const sessions = props.useSessions((s) => s);        // selector is mandatory!
const statuses = props.useSessionStatus((s) => s);
```

> ⚠️ These selector hooks go through `useSyncExternalStoreWithSelector`.
> Calling them without a selector crashes in WebKit with
> `l is not a function` — the selector identity `(s) => s` is required.

A session is listed when:

| Check | Source |
|---|---|
| `st.running === true` | live `sessionStatus` snapshot (primary) |
| or subagent count > 0 | `projectionsBySession[id].values.subagentCatalog` |
| and `updatedAt` < 10 min | freshness guard against zombie flags |

## Compatibility

| Host | Status |
|---|---|
| dsh-desktop (WebKit webview) | ✅ primary target |
| dsh web in Chromium browsers | ✅ |

No host-side changes, no new dependencies — client module only.

## License

[MIT](LICENSE)
