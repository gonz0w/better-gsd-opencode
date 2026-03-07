---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - plugin.js
  - install.js
  - package.json
  - README.md
  - opencode.json
autonomous: true
requirements: [PLUGIN-01, PLUGIN-02, PLUGIN-03]
must_haves:
  truths:
    - "plugin.js exports a valid OpenCode plugin with session.created, shell.env, and experimental.session.compacting hooks"
    - "install.js copies all bGSD assets to ~/.config/opencode/ and substitutes __OPENCODE_CONFIG__ placeholders"
    - "package.json is publishable to npm as get-shit-done-oc with correct bin entry"
    - "README.md has npm installation instructions"
  artifacts:
    - path: "plugin.js"
      provides: "OpenCode plugin with 3 hooks"
      contains: "export const"
    - path: "install.js"
      provides: "npx-compatible installer script"
      contains: "#!/usr/bin/env node"
    - path: "package.json"
      provides: "npm-publishable package config"
      contains: "get-shit-done-oc"
    - path: "opencode.json"
      provides: "Dev workspace OpenCode config"
      contains: "AGENTS.md"
  key_links:
    - from: "install.js"
      to: "deploy.sh"
      via: "mirrors deployment logic"
      pattern: "manifest\\.json|__OPENCODE_CONFIG__"
    - from: "plugin.js"
      to: "STATE.md"
      via: "reads state for compaction context"
      pattern: "STATE\\.md"
---

<objective>
Package bGSD as a full OpenCode plugin for npm distribution.

Purpose: Enable `npx get-shit-done-oc` installation instead of git clone + deploy.sh. Add OpenCode plugin hooks for session lifecycle integration.
Output: plugin.js, install.js, updated package.json, updated README.md, opencode.json
</objective>

<context>
@.planning/STATE.md
@AGENTS.md
@deploy.sh
@build.js
@package.json
@README.md
@.planning/quick/6-review-plugin-and-ensure-it-follows-best/6-REVIEW.md
@.planning/quick/7-address-critical-and-warning-findings-fr/7-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create plugin.js, install.js, and opencode.json</name>
  <files>plugin.js, install.js, opencode.json</files>
  <action>
**plugin.js** — ES module format OpenCode plugin with 3 hooks:

```js
import { readFileSync } from "fs"
import { join } from "path"
```

Export a named `BgsdPlugin` async function following OpenCode plugin pattern:
```js
export const BgsdPlugin = async ({ directory }) => { ... }
```

The function should:
1. Resolve `GSD_HOME` as the directory where gsd-tools.cjs lives. Use `import.meta` to find plugin's own directory, then resolve to the `get-shit-done` subdirectory of the OpenCode config. Since the plugin gets installed at `~/.config/opencode/plugins/bgsd.js`, GSD_HOME is `join(dirname(fileURLToPath(import.meta.url)), '..', 'get-shit-done')`. Use `fileURLToPath` from `node:url`.

2. Return hooks object with:

- `"session.created"`: Log `console.log("[bGSD] Planning plugin available. Use /bgsd-help to get started.")` so user knows bGSD is loaded.

- `"shell.env"`: Inject `GSD_HOME` env var:
  ```js
  output.env.GSD_HOME = gsdHome
  ```
  This lets workflows resolve `$GSD_HOME/bin/gsd-tools.cjs` without hardcoding paths.

- `"experimental.session.compacting"`: Read `.planning/STATE.md` from the project directory (`directory` from context or `input.cwd`). If the file exists, push its content into `output.context` array with a header:
  ```
  ## bGSD Project State (preserved across compaction)
  {stateContent}
  ```
  Wrap in try/catch — if no .planning/STATE.md exists, silently skip (project may not use bGSD).

**install.js** — Node.js script, shebang `#!/usr/bin/env node`, executable.

Mirror deploy.sh logic in Node.js:

1. Parse args: check for `--uninstall` flag, `--help` flag.

2. Define paths:
   - `DEST = join(homedir(), '.config', 'opencode', 'get-shit-done')`
   - `CMD_DIR = join(homedir(), '.config', 'opencode', 'commands')`
   - `AGENT_DIR = join(homedir(), '.config', 'opencode', 'agents')`
   - `PLUGIN_DIR = join(homedir(), '.config', 'opencode', 'plugins')`
   - `SRC = dirname(fileURLToPath(import.meta.url))` — the package root

3. If `--uninstall`:
   - Remove all `bgsd-*.md` files from CMD_DIR
   - Remove all `gsd-*.md` files from AGENT_DIR
   - Remove `PLUGIN_DIR/bgsd.js`
   - Remove DEST directory
   - Print "bGSD uninstalled successfully."
   - Exit.

4. If installing:
   - Create dirs: DEST, CMD_DIR, AGENT_DIR, PLUGIN_DIR
   - Read `bin/manifest.json` from SRC
   - For each file in manifest, determine destination (same logic as deploy.sh `dest_for_file`):
     - `commands/bgsd-*.md` → CMD_DIR
     - `agents/gsd-*.md` → AGENT_DIR
     - Everything else → DEST (maintaining subdirectory structure)
   - Copy each file, creating parent directories as needed
   - Copy `plugin.js` to `PLUGIN_DIR/bgsd.js`
   - Substitute `__OPENCODE_CONFIG__` placeholders in all `.md` files under DEST, CMD_DIR, and AGENT_DIR. Use `~/.config/oc` symlink path (same as deploy.sh). IMPORTANT: Create the `~/.config/oc` symlink pointing to `~/.config/opencode` if it doesn't exist.
   - Run smoke test: `execSync('node "DEST/bin/gsd-tools.cjs" util:current-timestamp --raw')`
   - On smoke failure, print error and suggest `--uninstall` to clean up
   - Print success summary: commands deployed count, agents deployed count

5. Use `import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync, statSync, unlinkSync, rmSync, symlinkSync, lstatSync } from 'fs'` and `import { execSync } from 'child_process'` and `import { join, dirname, basename } from 'path'` and `import { homedir } from 'os'` and `import { fileURLToPath } from 'url'`.

6. Add `"type": "module"` compatibility — this file is ESM (uses import.meta.url).

**opencode.json** — Minimal dev workspace config:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"]
}
```
  </action>
  <verify>
    - `node -c plugin.js` — syntax check passes
    - `node -c install.js` — syntax check passes
    - `node -e "import('./plugin.js').then(m => console.log(typeof m.BgsdPlugin))"` — prints "function"
    - `cat opencode.json | node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))"` — valid JSON
  </verify>
  <done>
    - plugin.js exports BgsdPlugin with session.created, shell.env, and experimental.session.compacting hooks
    - install.js is a working Node.js script with --uninstall support that mirrors deploy.sh logic
    - opencode.json exists with schema and instructions reference
  </done>
</task>

<task type="auto">
  <name>Task 2: Update package.json and README.md for npm distribution</name>
  <files>package.json, README.md</files>
  <action>
**package.json** — Update for npm publishing:

1. Change `"name"` from `"gsd-tools"` to `"get-shit-done-oc"`
2. Remove `"private": true`
3. Add `"type": "module"` (install.js and plugin.js are ESM; bin/gsd-tools.cjs stays CJS via .cjs extension)
4. Update `"description"` to `"AI project planning and execution plugin for OpenCode — structured milestones, 40 slash commands, 9 specialized agents"`
5. Add/update `"bin"` entry: `{ "get-shit-done-oc": "./install.js" }` (replaces the old gsd-tools entry which is internal)
6. Add `"keywords"`: `["opencode", "opencode-plugin", "ai", "planning", "project-management", "cli", "developer-tools"]`
7. Add `"repository"`: `{ "type": "git", "url": "https://github.com/gonz0w/bgsd-oc.git" }`
8. Add `"license"`: `"MIT"`
9. Add `"homepage"`: `"https://github.com/gonz0w/bgsd-oc#readme"`
10. Add `"files"` array to control what npm publishes: `["bin/", "commands/", "agents/", "workflows/", "templates/", "references/", "plugin.js", "install.js", "VERSION", "README.md", "LICENSE"]`
11. Move `"dependencies"` (acorn, tokenx) to `"bundledDependencies": ["acorn", "tokenx"]` — they're already bundled into gsd-tools.cjs by esbuild, so they're only needed at build time. Keep them in devDependencies along with esbuild/knip/madge. Actually, since they're bundled INTO the CJS file, they're not needed at runtime at all. Move them to devDependencies.
12. Keep `"engines"`: `{ "node": ">=18" }`

**README.md** — Update the Quick Start section and add install/uninstall:

Replace the current Quick Start section (lines 38-52) with:

```markdown
## Quick Start

### Install via npm

```bash
npx get-shit-done-oc
```

This installs all bGSD commands, agents, workflows, and the plugin into your OpenCode config directory (`~/.config/opencode/`).

Then in OpenCode:

```
/bgsd-new-project
```

That's it. bGSD walks you through everything: what you want to build, how to break it down, and then executes it phase by phase.

### Uninstall

```bash
npx get-shit-done-oc --uninstall
```

### Update

```bash
npx get-shit-done-oc@latest
```

See the **[Getting Started Guide](docs/getting-started.md)** for the full walkthrough, or the **[Expert Guide](docs/expert-guide.md)** if you want full control.
```

Also update line 8-10 — remove the old NOTE about symlinks and replace with a clean note:
```markdown
> **Note:** bGSD creates a `~/.config/oc` symlink pointing to `~/.config/opencode` to work around a path mangling issue in the Anthropic auth module. This is created automatically during installation.
```

Update the Development section (line 569+) to add a note that `deploy.sh` is the dev workflow and `npx get-shit-done-oc` is for end users.
  </action>
  <verify>
    - `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.name, p.type, !!p.private, p.bin)"` — prints `get-shit-done-oc module false { 'get-shit-done-oc': './install.js' }`
    - `grep 'npx get-shit-done-oc' README.md` — found in Quick Start section
    - `grep '\-\-uninstall' README.md` — uninstall instructions present
    - `npm pack --dry-run 2>&1 | head -30` — shows correct files list
  </verify>
  <done>
    - package.json is npm-publishable with correct name, bin, type, files, and metadata
    - README.md has npm install/uninstall/update instructions in Quick Start
    - Old "clone and deploy" instructions replaced with npx command
    - Development section preserved for contributors
  </done>
</task>

</tasks>

<verification>
1. `node -c plugin.js && node -c install.js` — both files parse without syntax errors
2. `node -e "import('./plugin.js').then(m => { const p = m.BgsdPlugin; console.log(typeof p === 'function' ? 'PASS' : 'FAIL') })"` — plugin exports correctly
3. `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); if (p.name === 'get-shit-done-oc' && p.type === 'module' && !p.private && p.bin['get-shit-done-oc'] === './install.js') console.log('PASS'); else console.log('FAIL')"` — package.json correct
4. `cat opencode.json | node -e "const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.instructions ? 'PASS' : 'FAIL')"` — opencode.json valid
5. `grep -c 'npx get-shit-done-oc' README.md` — at least 2 occurrences (install + update)
6. `npm run build` — build still succeeds (no breaking changes)
7. `npm test` — existing tests still pass (no regressions)
</verification>

<success_criteria>
- plugin.js is a valid ESM OpenCode plugin with 3 hooks (session.created, shell.env, experimental.session.compacting)
- install.js is an executable Node.js script that mirrors deploy.sh logic with --uninstall support
- package.json is ready for `npm publish` as `get-shit-done-oc`
- README.md documents npm installation as the primary method
- opencode.json exists for the dev workspace
- No breaking changes to existing deploy.sh or build.js
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/8-make-bgsd-a-full-opencode-plugin-using-o/8-SUMMARY.md`
</output>
