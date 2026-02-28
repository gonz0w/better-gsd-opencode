# Phase 28: Lifecycle Analysis - Research

**Researched:** 2026-02-26
**Domain:** CLI command engineering — execution order detection from filesystem conventions and content patterns
**Confidence:** HIGH

## Summary

Phase 28 adds a `codebase lifecycle` command that detects execution order relationships in codebases — migrations before seeds, config at boot, framework-specific initialization patterns — and outputs them as a directed acyclic graph (DAG). The core challenge is building a lifecycle detector registry (same pattern as the `FRAMEWORK_DETECTORS` array in `src/lib/conventions.js`) where each detector scans `codebase-intel.json` for lifecycle-relevant files, then extracts ordering relationships with confidence scores.

All necessary infrastructure already exists. Phase 23's `readIntel`/`writeIntel` handles caching. Phase 24's `FRAMEWORK_DETECTORS` array provides the exact registry pattern to copy. Phase 25's Tarjan's SCC (`findCycles`) detects cycles in the lifecycle DAG. The `intel.files` object already contains per-file metadata including paths that reveal migration directories, seed files, config directories, and application boot files. No new analysis pass is needed — lifecycle detection reshapes existing file metadata into ordering relationships.

The implementation scope is well-bounded: a new `src/lib/lifecycle.js` module with a `LIFECYCLE_DETECTORS` registry, a `buildLifecycleGraph()` function, and a `cmdCodebaseLifecycle()` command function. The two initial detectors are: (1) a generic detector for numbered/timestamped file ordering in known directories, and (2) an Elixir/Phoenix detector for `application.ex` boot order, migration→seed dependency, and router compilation. The DAG nodes use the shape defined in CONTEXT.md: `{ id, file_or_step, type, must_run_before[], must_run_after[], framework, confidence }`.

**Primary recommendation:** Implement as a new `src/lib/lifecycle.js` module following the exact patterns from `src/lib/deps.js` (Phase 25) and `src/lib/conventions.js` (Phase 24). Wire into `src/commands/codebase.js` as `cmdCodebaseLifecycle()` following the `cmdCodebaseDeps()`/`cmdCodebaseContext()` template. Cache results as `intel.lifecycle` alongside `intel.conventions` and `intel.dependencies`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Framework detection scope:** Start with patterns detectable via filename/path conventions and simple content scanning — no AST parsing. Support generic patterns that work across languages: migration ordering (numbered files), seed dependencies, config/env loading. Framework-specific: detect from existing `intel.conventions.framework_patterns` (Phase 24) — if Elixir/Phoenix detected, apply Phoenix-specific rules; if Next.js detected, apply Next.js rules; etc. Ship with 2-3 framework detectors (generic + the frameworks most likely encountered), make it extensible via detector registry pattern (same as Phase 24 framework detector). Don't try to be exhaustive — better to be accurate for common patterns than broad with false positives.
- **Lifecycle chain representation:** DAG (directed acyclic graph) — same adjacency list pattern used in Phase 25 dependency graph. Each node: `{ id, file_or_step, type, must_run_before[], must_run_after[], framework, confidence }`. Types: `migration`, `seed`, `config`, `boot`, `compilation`, `initialization`. Confidence score per relationship (high for numbered migrations, medium for convention-based detection). Cycles are errors — detect and report them (reuse Tarjan's SCC from Phase 25).
- **Output format and consumption:** JSON output via `--raw`, human-readable table/tree by default — consistent with all other codebase commands. Keep output terse and agent-facing — lifecycle context is consumed alongside task-scoped context. Include a `chains[]` array showing linear execution sequences (flattened from DAG for easy reading). Token budget: same philosophy as Phase 27 — keep it compact, agents don't need verbose explanations.
- **Detection heuristics:** Filename conventions first: numbered prefixes (001_, 002_), timestamp prefixes, alphabetical ordering in specific directories. Directory conventions: `migrations/`, `seeds/`, `priv/repo/`, `db/migrate/`, `config/`, `initializers/`. Content scanning (regex, not AST): `require`, `import`, `use`, `Application.start`, `Repo.migrate`, framework-specific function calls. Priority: filesystem ordering signals > content-based signals > convention-based guesses. Cache results in `codebase-intel.json` alongside existing intel data — reuse staleness infrastructure from Phase 23/26.

### Agent's Discretion
- Exact detector implementations and which specific frameworks to ship with
- Internal data structures for chain building
- How to handle ambiguous ordering (when confidence is low)
- Human-readable output formatting (tree vs table vs flat list)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIFE-01 | `codebase lifecycle` shows execution order relationships for detected frameworks | `LIFECYCLE_DETECTORS` registry scans `intel.files` for lifecycle-relevant paths (migrations/, seeds/, config/, application.ex), builds DAG of ordering relationships. Uses same `readIntel()`→detect→`writeIntel()` flow as `cmdCodebaseDeps()` and `cmdCodebaseConventions()`. |
| LIFE-02 | Lifecycle detection identifies framework-specific initialization patterns (starting with Elixir/Phoenix) | Elixir/Phoenix detector checks `intel.conventions.frameworks` for `elixir-phoenix` detection (already done by Phase 24), then scans for `application.ex` (boot supervisor tree), `priv/repo/migrations/` (timestamped ordering), `priv/repo/seeds.exs` (runs after migrations), `router.ex` (compiled at boot). Generic detector handles numbered-file ordering in any `migrations/` or `db/migrate/` directory. |
| LIFE-03 | Lifecycle analysis outputs a dependency chain (which files/operations must run before others) | DAG flattened into `chains[]` array via topological sort. Each chain is a linear sequence of steps. Cycles detected by reusing `findCycles()` from Phase 25's `src/lib/deps.js`. JSON output shape: `{ nodes[], edges[], chains[], cycles[], stats{} }`. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | Read file paths and content from intel cache | Zero-dependency constraint (C-01) |
| Node.js path | built-in | Path manipulation for directory/file classification | Zero-dependency constraint (C-01) |
| Existing `readIntel`/`writeIntel` | from Phase 23 | Load and persist codebase-intel.json | Already battle-tested across 5 phases |
| Existing `findCycles` (Tarjan's SCC) | from Phase 25 | Cycle detection in lifecycle DAG | O(V+E) standard algorithm, already implemented |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `FRAMEWORK_DETECTORS` pattern | from Phase 24 | Registry pattern for lifecycle detectors | Directly copied — `LIFECYCLE_DETECTORS` is an array of `{ name, detect(), extractLifecycle() }` objects |
| `intel.conventions.frameworks` | from Phase 24 | Determine which framework detectors to activate | Check `framework` field in framework patterns to gate Elixir/Phoenix detector |
| `debugLog` | from `require_output()` | Debug logging for detection steps | Same pattern as all other codebase modules |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom DAG | Reuse `forward`/`reverse` from deps.js | Lifecycle graph has different node shape (`type`, `confidence`) — needs its own structure, but can reuse Tarjan's SCC for cycle detection |
| AST parsing for boot order | Regex content scanning | CONTEXT.md explicitly locks "no AST parsing" — regex provides sufficient accuracy for `Application.start`, `Repo.migrate`, `use GenServer` patterns |
| Per-file lifecycle scanning | Intel-cache-only detection | Scanning all files every time would be slow; instead scan `intel.files` paths first (fast), only read file content for files that match lifecycle-relevant directory patterns |

## Architecture Patterns

### Recommended Module Structure
```
src/
├── lib/
│   └── lifecycle.js        # LIFECYCLE_DETECTORS registry, buildLifecycleGraph(), topological sort, chain flattening
├── commands/
│   └── codebase.js         # cmdCodebaseLifecycle() added here (alongside existing cmdCodebaseDeps, etc.)
└── router.js               # "lifecycle" case added to codebase switch
```

### Pattern 1: Lifecycle Detector Registry
**What:** Array of detector objects, each with `name`, `detect(intel)`, and `extractLifecycle(intel, cwd)` methods.
**When to use:** For every new framework lifecycle pattern.
**Why:** Identical to `FRAMEWORK_DETECTORS` in `src/lib/conventions.js` — proven extensible pattern.
**Example:**
```javascript
// Follows FRAMEWORK_DETECTORS pattern from conventions.js:8201
var LIFECYCLE_DETECTORS = [
  {
    name: 'generic-migrations',
    detect(intel) {
      // Check for migration directories in intel.files paths
      const filePaths = Object.keys(intel.files || {});
      return filePaths.some(f =>
        /migrations\//.test(f) || /db\/migrate\//.test(f) || /priv\/repo\/migrations\//.test(f)
      );
    },
    extractLifecycle(intel, cwd) {
      // Return array of { id, file_or_step, type, must_run_before, must_run_after, framework, confidence }
      const nodes = [];
      // ... detect numbered ordering in migration directories
      return nodes;
    }
  },
  {
    name: 'elixir-phoenix',
    detect(intel) {
      // Gate on framework detection from Phase 24
      if (!intel.conventions || !intel.conventions.frameworks) return false;
      return intel.conventions.frameworks.some(f => f.framework === 'elixir-phoenix');
    },
    extractLifecycle(intel, cwd) {
      // Detect: application.ex boot → migrations → seeds → router compilation
      const nodes = [];
      // ...
      return nodes;
    }
  }
];
```

### Pattern 2: DAG Node Shape
**What:** Each lifecycle node represents a file or execution step with ordering edges.
**When to use:** For every node in the lifecycle graph.
**Example:**
```javascript
// Node shape from CONTEXT.md decisions
{
  id: 'migration:20240101120000_create_users',
  file_or_step: 'priv/repo/migrations/20240101120000_create_users.exs',
  type: 'migration',           // migration|seed|config|boot|compilation|initialization
  must_run_before: ['migration:20240201120000_add_email'],
  must_run_after: [],
  framework: 'elixir-phoenix', // or 'generic'
  confidence: 95               // high for numbered, medium for convention
}
```

### Pattern 3: Chain Flattening via Topological Sort
**What:** Convert DAG into linear `chains[]` array for agent consumption.
**When to use:** For the output format.
**Example:**
```javascript
// Kahn's algorithm (BFS-based topological sort) — simple, O(V+E)
function topologicalSort(nodes) {
  const inDegree = {};
  const adjacency = {};
  // Build in-degree map from must_run_before edges
  for (const node of nodes) {
    if (!inDegree[node.id]) inDegree[node.id] = 0;
    if (!adjacency[node.id]) adjacency[node.id] = [];
    for (const dep of node.must_run_before) {
      adjacency[node.id].push(dep);
      inDegree[dep] = (inDegree[dep] || 0) + 1;
    }
  }
  // BFS from zero in-degree nodes
  const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const next of (adjacency[current] || [])) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }
  return sorted;
}
```

### Pattern 4: Integration with `autoTriggerCodebaseIntel`
**What:** Preserve `intel.lifecycle` during background re-analysis, same as conventions and dependencies.
**When to use:** In `autoTriggerCodebaseIntel()` in `src/lib/codebase-intel.js`.
**Example:**
```javascript
// In autoTriggerCodebaseIntel, after the existing convention/dependency preservation:
if (intel.lifecycle && !newIntel.lifecycle) {
  newIntel.lifecycle = intel.lifecycle;
}
```

### Anti-Patterns to Avoid
- **Over-detection:** Don't mark every file in `config/` as a lifecycle step. Only files with clear ordering signals (numbered, timestamped, or explicit dependency markers) should become nodes.
- **Deep content parsing:** Resist the urge to do multi-line regex or pseudo-AST parsing. Simple single-line regexes for `Application.start`, `Repo.migrate`, `use Supervisor` are sufficient.
- **Transitive closure in chains:** Don't expand the full transitive closure. `chains[]` should show the direct topological sort, not every possible path through the DAG.
- **Framework detection duplication:** Don't re-detect frameworks. Use `intel.conventions.frameworks` from Phase 24 as the authoritative source. If conventions haven't been extracted yet, skip framework-specific detectors and only run the generic detector.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Custom cycle finder | `findCycles()` from `src/lib/deps.js` | Already implemented O(V+E) Tarjan's SCC, tested |
| Framework detection | New framework sniffing | `intel.conventions.frameworks` from Phase 24 | Already detected by `FRAMEWORK_DETECTORS` with confidence scores |
| File caching | Custom file reading | `readIntel()`/`writeIntel()` from Phase 23 | Handles JSON parse errors, staleness, path resolution |
| Debug logging | `console.log` | `debugLog()` from `require_output()` | Respects `GSD_DEBUG` env var, consistent output formatting |
| Intel preservation | Manual copy logic | Extend existing `autoTriggerCodebaseIntel` pattern | Lines 9241-9246 already preserve `conventions` and `dependencies` during refresh |

**Key insight:** Phase 28 has the smallest net-new code footprint of any Phase 23-28 implementation because the detector registry, DAG structure, cycle detection, caching, and output patterns all exist from prior phases. The new work is exclusively the detection heuristics (which files imply lifecycle ordering) and the chain flattening logic (topological sort).

## Common Pitfalls

### Pitfall 1: False Positives from Config Directories
**What goes wrong:** Marking every file in `config/` as a lifecycle step creates a noisy, unhelpful graph.
**Why it happens:** Config directories contain many files, but most have no ordering relationship (e.g., `config/dev.exs` and `config/test.exs` are parallel, not sequential).
**How to avoid:** Only create lifecycle nodes for config files with explicit ordering signals — numbered prefixes, `import_config` directives, or known boot-order conventions (e.g., `config/config.exs` before `config/runtime.exs` in Elixir).
**Warning signs:** More than 10 config-type nodes in a project with < 5 actual boot steps.

### Pitfall 2: Timestamp Parse Ambiguity
**What goes wrong:** Treating `20240101` as both a date-based timestamp AND a numeric sequence number leads to duplicate ordering or incorrect confidence scores.
**Why it happens:** Both conventions use numeric prefixes. `20240101120000_create_users.exs` is a timestamp; `001_create_users.sql` is a sequence number. Both indicate ordering, but the confidence and detection mechanism differ.
**How to avoid:** Classify by digit count: 14-digit prefixes are timestamps (YYYYMMDDHHMMSS), 1-4 digit prefixes are sequence numbers, 8-digit prefixes are date-only (YYYYMMDD). All indicate ordering but with different confidence levels.
**Warning signs:** Migrations showing up with duplicate orderings or mixed confidence.

### Pitfall 3: Missing `must_run_after` Symmetry
**What goes wrong:** When node A has `must_run_before: ['B']`, node B must have `must_run_after: ['A']` — but building only one direction creates an incomplete graph that topological sort can't fully order.
**Why it happens:** It's natural to think in one direction ("migrations run before seeds") and forget to populate the reverse edge.
**How to avoid:** Build edges in one direction (e.g., `must_run_before`) during detection, then derive `must_run_after` as a post-processing step before output. Same forward/reverse pattern as dependency graph.
**Warning signs:** Topological sort producing incomplete chains where known-dependent steps appear before their prerequisites.

### Pitfall 4: Lifecycle Graph Reuse of deps.js `findCycles`
**What goes wrong:** `findCycles()` expects `{ forward: { file: [file, ...] } }` shape, but lifecycle DAG has `{ id: ..., must_run_before: [...] }` shape.
**Why it happens:** Different graph representations between deps.js (file-keyed adjacency list) and lifecycle.js (node objects with edge arrays).
**How to avoid:** Before calling `findCycles()`, convert the lifecycle DAG into the `{ forward: {} }` shape expected by deps.js. This is a simple transformation: `forward[node.id] = node.must_run_before`.
**Warning signs:** `findCycles` returning empty results on a graph that visually has cycles.

### Pitfall 5: Slow Content Scanning on Large Projects
**What goes wrong:** Reading every `.ex` file to check for `Application.start` or `Repo.migrate` is slow on large projects.
**Why it happens:** Content scanning is O(files × file_size), compared to path-only detection which is O(files).
**How to avoid:** Two-phase detection: (1) path-based filtering to identify candidate files (e.g., files in `lib/*/application.ex`, `priv/repo/seeds.exs`), then (2) content scanning only on candidates. Path filtering is <1ms; content scanning should only touch 5-20 files total.
**Warning signs:** `codebase lifecycle` taking >100ms on a project with <500 files.

## Code Examples

### Example 1: Generic Migration Detector
```javascript
// Detects numbered/timestamped ordering in migration directories
// Confidence: HIGH (95) for numbered files, MEDIUM (70) for convention-based
function detectMigrationOrder(intel) {
  const filePaths = Object.keys(intel.files || {});
  const migrationDirs = new Set();
  const MIGRATION_PATTERNS = [
    /^(.*\/)?migrations\//,
    /^(.*\/)?db\/migrate\//,
    /^(.*\/)?priv\/[^/]*\/migrations\//
  ];

  // Find migration directories
  for (const f of filePaths) {
    for (const pattern of MIGRATION_PATTERNS) {
      if (pattern.test(f)) {
        const dir = f.replace(/\/[^/]+$/, '');
        migrationDirs.add(dir);
      }
    }
  }

  const nodes = [];
  for (const dir of migrationDirs) {
    // Get files in this directory, sorted by name
    const dirFiles = filePaths
      .filter(f => f.startsWith(dir + '/') && !f.slice(dir.length + 1).includes('/'))
      .sort();

    let prevId = null;
    for (const file of dirFiles) {
      const basename = path.basename(file);
      const isNumbered = /^\d+[_-]/.test(basename);
      const isTimestamped = /^\d{14}[_-]/.test(basename);

      const id = `migration:${basename.replace(/\.[^.]+$/, '')}`;
      const node = {
        id,
        file_or_step: file,
        type: 'migration',
        must_run_before: [],
        must_run_after: prevId ? [prevId] : [],
        framework: 'generic',
        confidence: isTimestamped ? 95 : isNumbered ? 90 : 70
      };

      if (prevId) {
        // Update previous node's must_run_before
        const prevNode = nodes.find(n => n.id === prevId);
        if (prevNode) prevNode.must_run_before.push(id);
      }

      nodes.push(node);
      prevId = id;
    }
  }
  return nodes;
}
```

### Example 2: Elixir/Phoenix Lifecycle Detector
```javascript
// Detects: application.ex boot → migrations → seeds → router compilation
// Only activates when intel.conventions.frameworks includes 'elixir-phoenix'
function detectPhoenixLifecycle(intel, cwd) {
  const filePaths = Object.keys(intel.files || {});
  const nodes = [];

  // 1. Application boot (application.ex defines supervisor tree start order)
  const appFile = filePaths.find(f => /lib\/[^/]+\/application\.ex$/.test(f));
  if (appFile) {
    nodes.push({
      id: 'boot:application',
      file_or_step: appFile,
      type: 'boot',
      must_run_before: [],  // filled in later
      must_run_after: [],
      framework: 'elixir-phoenix',
      confidence: 95
    });
  }

  // 2. Config loading (config.exs → runtime.exs)
  const configExs = filePaths.find(f => f === 'config/config.exs');
  const runtimeExs = filePaths.find(f => f === 'config/runtime.exs');
  if (configExs) {
    const configNode = {
      id: 'config:compile-time',
      file_or_step: configExs,
      type: 'config',
      must_run_before: appFile ? ['boot:application'] : [],
      must_run_after: [],
      framework: 'elixir-phoenix',
      confidence: 95
    };
    nodes.push(configNode);
  }
  if (runtimeExs) {
    nodes.push({
      id: 'config:runtime',
      file_or_step: runtimeExs,
      type: 'config',
      must_run_before: appFile ? ['boot:application'] : [],
      must_run_after: configExs ? ['config:compile-time'] : [],
      framework: 'elixir-phoenix',
      confidence: 90
    });
  }

  // 3. Seeds depend on migrations
  const seedFile = filePaths.find(f => /seeds\.exs$/.test(f));
  const migrationFiles = filePaths.filter(f => /priv\/repo\/migrations\//.test(f));
  if (seedFile && migrationFiles.length > 0) {
    // Last migration must run before seeds
    const sortedMigrations = migrationFiles.sort();
    const lastMigrationBasename = path.basename(sortedMigrations[sortedMigrations.length - 1]);
    const lastMigrationId = `migration:${lastMigrationBasename.replace(/\.[^.]+$/, '')}`;

    nodes.push({
      id: 'seed:seeds',
      file_or_step: seedFile,
      type: 'seed',
      must_run_before: [],
      must_run_after: [lastMigrationId],
      framework: 'elixir-phoenix',
      confidence: 90
    });
  }

  // 4. Router (compiled at boot, defines endpoint structure)
  const routerFile = filePaths.find(f => /router\.ex$/.test(f));
  if (routerFile && appFile) {
    nodes.push({
      id: 'compilation:router',
      file_or_step: routerFile,
      type: 'compilation',
      must_run_before: [],
      must_run_after: ['boot:application'],
      framework: 'elixir-phoenix',
      confidence: 85
    });
  }

  return nodes;
}
```

### Example 3: Topological Sort for Chain Flattening
```javascript
// Kahn's algorithm — returns ordered chain of node IDs
// If cycle exists, remaining nodes won't be in output (detected separately by findCycles)
function buildChains(nodes) {
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const inDegree = {};
  const adjacency = {};
  for (const node of nodes) {
    if (!inDegree[node.id]) inDegree[node.id] = 0;
    if (!adjacency[node.id]) adjacency[node.id] = [];
    for (const after of node.must_run_before) {
      adjacency[node.id].push(after);
      inDegree[after] = (inDegree[after] || 0) + 1;
    }
  }

  // Find connected components first, then topo-sort each
  const visited = new Set();
  const components = [];

  function bfsComponent(start) {
    const comp = new Set();
    const q = [start];
    comp.add(start);
    while (q.length > 0) {
      const cur = q.shift();
      // Follow both directions for component discovery
      for (const next of (adjacency[cur] || [])) {
        if (!comp.has(next)) { comp.add(next); q.push(next); }
      }
      const node = nodeMap[cur];
      if (node) {
        for (const prev of node.must_run_after) {
          if (!comp.has(prev)) { comp.add(prev); q.push(prev); }
        }
      }
    }
    return comp;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const comp = bfsComponent(node.id);
      for (const id of comp) visited.add(id);
      components.push(comp);
    }
  }

  // Topo-sort each component
  const chains = [];
  for (const comp of components) {
    const compNodes = [...comp].filter(id => inDegree[id] !== undefined);
    const queue = compNodes.filter(id => (inDegree[id] || 0) === 0);
    const sorted = [];
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      for (const next of (adjacency[current] || [])) {
        if (comp.has(next)) {
          inDegree[next]--;
          if (inDegree[next] === 0) queue.push(next);
        }
      }
    }
    if (sorted.length > 1) {
      chains.push(sorted);
    }
  }
  return chains;
}
```

### Example 4: Command Function Template
```javascript
// Follows cmdCodebaseDeps() pattern exactly — read intel, detect, cache, output
function cmdCodebaseLifecycle(cwd, args, raw) {
  const intel = readIntel(cwd);
  if (!intel) {
    error('No codebase intel. Run: codebase analyze');
    return;
  }

  const { buildLifecycleGraph, findLifecycleCycles } = require_lifecycle();
  const lifecycle = buildLifecycleGraph(intel, cwd);

  // Cache in intel
  intel.lifecycle = lifecycle;
  writeIntel(cwd, intel);

  output({
    success: true,
    nodes: lifecycle.nodes.length,
    edges: lifecycle.edge_count,
    chains: lifecycle.chains,
    cycles: lifecycle.cycles,
    detectors_used: lifecycle.detectors_used,
    stats: lifecycle.stats,
    built_at: lifecycle.built_at
  }, raw);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AST-based lifecycle analysis | Regex + filesystem convention scanning | Project constraint (C-01: zero dependencies) | Sacrifices ~10% accuracy for zero-dependency constraint; acceptable per CONTEXT.md |
| Monolithic framework detection | Detector registry pattern | Phase 24 (conventions) | Each framework is a pluggable object; new frameworks added by pushing to array |
| Full transitive graph output | Chain-flattened output with token budget | Phase 27 philosophy | Agents consume compact chains, not raw DAGs |

**Deprecated/outdated:**
- None specific to this phase. The pattern is well-established across Phases 23-27.

## Open Questions

1. **How many lifecycle nodes is realistic for a medium project?**
   - What we know: A typical Elixir/Phoenix project with 50 migrations, 1 seed file, 3 config files, 1 application.ex, and 1 router.ex would produce ~56 nodes. The chain flattening would produce 2-3 chains (migrations chain, config→boot chain, boot→router chain).
   - What's unclear: Whether 56 nodes fits comfortably in agent token budgets alongside other context.
   - Recommendation: Cap migration nodes at a configurable limit (default 20 most recent). Show `... and N earlier migrations` for older ones. This keeps output under 1K tokens for the lifecycle section.

2. **Should lifecycle detection auto-run on `codebase analyze`?**
   - What we know: Conventions auto-extract on first `codebase conventions` call, not on `analyze`. Dependencies similarly auto-build on first `codebase deps` call.
   - What's unclear: Whether lifecycle should follow the same lazy-build pattern or be part of `analyze`.
   - Recommendation: Lazy-build (same as conventions and dependencies). First `codebase lifecycle` call builds and caches; subsequent calls use cached. This is consistent with existing patterns and avoids slowing down `analyze`.

3. **Which 2-3 framework detectors to ship with?**
   - What we know: CONTEXT.md says "generic + the frameworks most likely encountered." The project currently only has an Elixir/Phoenix framework detector in `FRAMEWORK_DETECTORS`.
   - What's unclear: Whether to add Node.js/Express (package.json scripts ordering) or Rails (db/migrate + db/seeds.rb) as the third detector.
   - Recommendation: Ship with (1) generic numbered-file detector and (2) Elixir/Phoenix detector. This aligns with the existing framework detector scope. A third detector can be added later if needed — the registry pattern makes this trivial.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** — Direct reading of `bin/gsd-tools.cjs` lines 7522-9707 (codebase-intel.js, conventions.js, deps.js, codebase commands). All infrastructure patterns verified from source code.
- **CONTEXT.md decisions** — Locked implementation decisions verified from `.planning/phases/28-lifecycle-analysis/28-CONTEXT.md`.
- **REQUIREMENTS.md** — LIFE-01, LIFE-02, LIFE-03 requirement text verified from `.planning/REQUIREMENTS.md` lines 35-37.
- **Prior phase plans** — Phase 25 (deps.js) plan structure and Phase 27 (context) research verified from `.planning/phases/` archives.

### Secondary (MEDIUM confidence)
- **Topological sort algorithm (Kahn's)** — Standard CS algorithm, well-known O(V+E). Not verified via external source but is textbook material. HIGH confidence in correctness.
- **Elixir/Phoenix lifecycle conventions** — `config.exs` → `runtime.exs` → `application.ex` boot → `Repo.migrate` → `seeds.exs` ordering is standard Phoenix convention. Verified against existing framework detector code detecting `priv/repo/migrations/` and `router.ex` patterns.

### Tertiary (LOW confidence)
- None. All findings based on direct codebase inspection and locked CONTEXT.md decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 100% reuse of existing infrastructure (readIntel, writeIntel, findCycles, FRAMEWORK_DETECTORS pattern, debugLog)
- Architecture: HIGH — Detector registry pattern proven across Phase 24 (conventions) and Phase 25 (deps), DAG and topological sort are standard algorithms
- Pitfalls: HIGH — Identified from direct analysis of existing code patterns and data shape mismatches between modules
- Code examples: HIGH — All examples based on actual code patterns from the codebase, adapted for lifecycle domain

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable — all infrastructure is internal, no external dependency version churn)
