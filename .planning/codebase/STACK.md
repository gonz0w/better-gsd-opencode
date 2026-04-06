# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- JavaScript (ESM) - Core CLI and modules in `src/`, bundled to `bin/bgsd-tools.cjs`

**Secondary:**
- Shell/Bash - Deployment scripts (`deploy.sh`), helper commands

## Runtime

**Environment:**
- Node.js >=18 - Required runtime per `package.json` engines field

**Package Manager:**
- npm - Primary package manager (Node.js bundled)
- Lockfile: bun.lock present in `.opencode/` for OpenCode plugin deps

## Frameworks

**Core:**
- ES Modules (`"type": "module"` in `package.json`) - Modern module system throughout codebase

**Testing:**
- Node Test Runner - Built-in test framework
  - Config: inline via `package.json` scripts
  - Command: `node --test --test-force-exit --test-concurrency=8 tests/*.test.cjs`
  - Coverage: 762+ tests across 70+ test files

**Build/Dev:**
- esbuild ^0.27.3 - Bundler for single-file CLI output (`bin/bgsd-tools.cjs`)
  - Config: `build.cjs` (18KB build script)
- knip ^5.85.0 - Dead code detection
  - Command: `npm run audit:dead-code`
- madge ^8.0.0 - Circular dependency detection
  - Command: `npm run audit:circular`

## Key Dependencies

**Critical:**
- valibot ^1.2.0 - Schema validation for config contracts and state management
- fast-glob ^3.3.3 - File discovery and pattern matching (replaces fs.walk)
- fuse.js ^7.1.0 - Fuzzy search for command/agent lookup
- ignore ^7.0.5 - Gitignore parsing for file exclusion
- inquirer ^8.2.6 - CLI interactive prompts

**Infrastructure:**
- acorn ^8.16.0 - JavaScript AST parser for code analysis (complexity, exports, signatures)
- tokenx ^1.3.0 - Token handling utilities
- zod ^4.3.6 - Additional schema validation layer

## Configuration

**Environment:**
- Runtime detection: `auto/bun/node` via `runtime` config key
- Tool toggles: 9 CLI tools configurable per-project (ripgrep, fd, jq, yq, ast-grep, sd, hyperfine, bat, gh)
- Optimization flags: valibot, discovery mode, compile cache, SQLite caching

**Build:**
- Single-file bundle: `bin/bgsd-tools.cjs` (1.2MB, 3053 lines) contains all logic
- Source modules: `src/` directory with 8 subdirectories (commands, lib, plugin, router.js)
- Build script: `build.cjs` handles esbuild bundling

## Platform Requirements

**Development:**
- Node.js >=18
- Optional CLI tools for full feature set: ripgrep, fd, jq, yq, ast-grep, sd, hyperfine, bat, gh
- Optional research tools: yt-dlp (YouTube), notebooklm-py (RAG synthesis)

**Production:**
- Deployment target: OpenCode editor plugin (VS Code-compatible)
- Zero external dependencies at runtime (all bundled into single file)
- Git repository required for version control operations

---

*Stack analysis: 2026-04-06*
