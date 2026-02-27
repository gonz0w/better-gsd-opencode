# Architecture Research: v7.0 Agent Orchestration & Efficiency

**Domain:** CLI-based AI agent orchestration plugin  
**Researched:** 2026-02-26  
**Overall confidence:** HIGH  
**Mode:** Integration architecture for existing 18-module codebase

## Executive Summary

v7.0 adds agent orchestration intelligence, specialized agent roles, and context reduction to an existing 18-module CLI (9 lib + 8 commands + router + index). The key architectural question is: **where does orchestration logic live** — in the CLI tool, in workflow markdown, or in a hybrid?

After analyzing the existing architecture, the answer is **hybrid with clear boundaries**: task analysis and routing recommendations live in the CLI (new lib modules), while agent spawning and coordination stays in workflow markdown. This matches the established pattern: `gsd-tools.cjs` provides structured JSON data, workflows consume it and make execution decisions.

Three new lib modules are recommended: `src/lib/orchestrator.js` (task classification, routing, parallelism analysis), `src/lib/profiler.js` (context measurement, reduction recommendations), and one new command module `src/commands/agent.js` (agent-facing CLI commands). Git intelligence extends the existing `src/lib/git.js` module. Context reduction operates at **both** the CLI output level (smaller JSON payloads) and workflow level (smarter @-reference loading).

## Recommended Architecture

### High-Level Data Flow

```
User invokes /gsd-execute-phase
  → workflow reads execute-phase.md
    → calls gsd-tools init execute-phase (existing)
    → calls gsd-tools agent classify-tasks (NEW: returns routing recommendations)
    → calls gsd-tools agent context-profile (NEW: returns token budget per agent)
    → workflow spawns Task() with routing-informed prompts
      → subagent reads execute-plan.md + injected context
      → subagent calls gsd-tools for data (existing pattern)
      → subagent returns structured result
    → workflow aggregates results (existing pattern)
```

### Component Boundaries

| Component | Responsibility | Communicates With | Layer |
|-----------|---------------|-------------------|-------|
| `src/lib/orchestrator.js` (NEW) | Task classification, complexity scoring, agent routing recommendations, parallelism analysis | helpers.js, git.js, codebase-intel.js | lib |
| `src/lib/profiler.js` (NEW) | Context measurement, token budgets per agent type, reduction recommendations, payload trimming | context.js, helpers.js | lib |
| `src/commands/agent.js` (NEW) | CLI interface for orchestration commands (`agent classify-tasks`, `agent context-profile`, `agent suggest-routing`) | orchestrator.js, profiler.js, format.js, output.js | commands |
| `src/lib/git.js` (EXTENDED) | Add branch management, PR workflow helpers, conflict prediction, merge intelligence | (standalone — no new deps) | lib |
| `src/commands/init.js` (MODIFIED) | Inject orchestration metadata into existing init payloads | orchestrator.js, profiler.js | commands |
| `router.js` (MODIFIED) | Add `agent` command routing | agent.js | router |
| Workflow files (MODIFIED) | Consume new CLI data for smarter spawning decisions | gsd-tools.cjs | workflow |

### Module Dependency Graph (Existing + New)

```
                    ┌──────────────────────────────────────────────────┐
                    │                  router.js                       │
                    │  (dispatches to command modules)                  │
                    └──────┬──────┬──────┬──────┬──────┬───────────────┘
                           │      │      │      │      │
              ┌────────────┤      │      │      │      ├─────────────┐
              ▼            ▼      ▼      ▼      ▼      ▼             ▼
         commands/     commands/ commands/ commands/ commands/   commands/
         init.js       state.js  verify.js features.js codebase.js agent.js
              │            │      │      │      │            │    (NEW)
              │            │      │      │      │            │
              ▼            ▼      ▼      ▼      ▼            ▼
         ┌─────────────────────────────────────────────────────────────┐
         │                    lib/ modules                             │
         │                                                             │
         │  helpers.js ◄── config.js ◄── constants.js                  │
         │      ▲               ▲                                      │
         │      │               │                                      │
         │  git.js          output.js ◄── format.js                    │
         │  (EXTENDED)                                                 │
         │      ▲                                                      │
         │      │                                                      │
         │  codebase-intel.js ──► deps.js ──► conventions.js           │
         │      ▲                              ──► lifecycle.js        │
         │      │                                                      │
         │  context.js      frontmatter.js     regex-cache.js          │
         │      ▲                                                      │
         │      │                                                      │
         │  orchestrator.js ◄── profiler.js    (BOTH NEW)              │
         │                                                             │
         └─────────────────────────────────────────────────────────────┘

         Direction: commands → lib (never reverse)
         New modules follow existing dependency direction
```

### Data Flow for Task Routing

```
Workflow (execute-phase.md)
  │
  ├─ Step 1: gsd-tools init execute-phase {phase}
  │    → Returns: plans[], models, config, codebase context
  │
  ├─ Step 2: gsd-tools agent classify-tasks {phase}     ◄── NEW
  │    → orchestrator.js reads each PLAN.md frontmatter
  │    → Classifies: complexity (simple/moderate/complex),
  │       task_type (code/test/refactor/docs/config),
  │       risk_level (low/medium/high from files_modified + dep graph),
  │       parallelism_safe (bool from file overlap analysis)
  │    → Returns: per-plan routing recommendations
  │       {
  │         plans: [{
  │           plan_id, complexity, task_type, risk_level,
  │           recommended_model, parallelism_safe,
  │           estimated_tokens, context_budget
  │         }],
  │         wave_optimization: { ... },
  │         total_estimated_tokens: N
  │       }
  │
  ├─ Step 3: gsd-tools agent context-profile {plan}      ◄── NEW
  │    → profiler.js estimates token cost of agent spawn
  │    → Measures: workflow template, plan content, @-references,
  │       codebase_context injection, state/roadmap data
  │    → Returns: token breakdown, reduction recommendations
  │       {
  │         total_tokens: N,
  │         breakdown: { plan: N, workflow: N, references: N, codebase: N },
  │         budget_percent: N,
  │         recommendations: ["trim codebase_context to top 5 deps", ...]
  │       }
  │
  ├─ Step 4: Workflow applies routing
  │    → Uses classify-tasks output to:
  │       - Select model per plan (quality for complex, budget for simple)
  │       - Skip worktree for single-file plans
  │       - Group parallelism-safe plans in same wave
  │       - Apply context-profile recommendations
  │
  └─ Step 5: Spawn Task() with optimized prompts
       → Existing subagent pattern unchanged
       → But with better model selection and leaner context
```

## New Module Specifications

### 1. `src/lib/orchestrator.js` — Task Intelligence

**Purpose:** Analyze PLAN.md files to classify complexity, risk, and optimal execution strategy. Pure data analysis — no execution decisions.

**Depends on:** helpers.js (findPhaseInternal, cachedReadFile, getPhaseTree), frontmatter.js (extractFrontmatter), codebase-intel.js (readIntel), deps.js (getTransitiveDependents), git.js (execGit)

**Exports:**

```javascript
module.exports = {
  classifyTask,           // (planContent) → { complexity, task_type, risk_level }
  classifyPhaseTasks,     // (cwd, phase) → { plans: [...], wave_optimization }
  analyzeParallelism,     // (cwd, phase) → { safe_groups: [...], conflict_risks: [...] }
  estimateEffort,         // (planContent) → { task_count, estimated_tokens, files_touched }
};
```

**Classification heuristics:**
- **Complexity:** task count (1-3: simple, 4-7: moderate, 8+: complex), files_modified count, dependency fan-out
- **Task type:** keyword analysis of task descriptions (test/spec → test, refactor/rename → refactor, README/docs → docs, config/env → config, default → code)
- **Risk level:** files_modified crossed with dependency graph fan-in (high fan-in files = high risk), presence of test tasks as guards

**Size estimate:** ~200-300 lines. Follows conventions.js pattern (analysis engine with registry).

### 2. `src/lib/profiler.js` — Context Optimization

**Purpose:** Measure and optimize token usage for agent spawns. Provides recommendations, does not modify content.

**Depends on:** context.js (estimateTokens, checkBudget), helpers.js (cachedReadFile), config.js (loadConfig)

**Exports:**

```javascript
module.exports = {
  profileAgentContext,    // (cwd, planPath, options) → { total_tokens, breakdown, recommendations }
  measureWorkflowCost,   // (workflowPath) → { tokens, sections: [...] }
  suggestReductions,     // (profile, budget) → string[] recommendations
  trimPayload,           // (jsonPayload, budget) → trimmed payload (lossy but bounded)
};
```

**Key design decisions:**
- Uses existing `estimateTokens()` from context.js (~96% accuracy via tokenx)
- Profiles each context source independently: plan content, workflow template, @-file references, codebase_context injection, STATE.md/ROADMAP.md
- Recommendations are strings, not actions — workflow decides whether to apply
- `trimPayload` implements progressive disclosure: keep most-relevant data, replace rest with `"... N more items (use --verbose)"`

**Size estimate:** ~150-250 lines. Follows context.js pattern (estimation + budget checking).

### 3. `src/commands/agent.js` — Orchestration CLI

**Purpose:** Expose orchestration intelligence as CLI commands for workflow consumption.

**Depends on:** orchestrator.js, profiler.js, output.js, format.js

**Commands routed via router.js:**
- `gsd-tools agent classify-tasks {phase}` — classify all plans in a phase
- `gsd-tools agent context-profile {plan-path}` — profile token usage for an agent spawn
- `gsd-tools agent suggest-routing {phase}` — suggest model assignments and parallelism strategy
- `gsd-tools agent health` — system-wide orchestration health (active agents, resource usage)

**Size estimate:** ~200-300 lines. Follows existing command module patterns (parse args, call lib, format output).

### 4. `src/lib/git.js` — Extended Git Intelligence

**Current state:** 29 lines. Single function `execGit(cwd, args)`.

**Extensions (append, don't modify existing):**

```javascript
// Branch management
function getCurrentBranch(cwd) { ... }
function branchExists(cwd, name) { ... }
function getRemoteBranches(cwd) { ... }

// PR workflow helpers
function getUnpushedCommits(cwd) { ... }
function getDiffStat(cwd, base, head) { ... }

// Conflict prediction
function predictMergeConflicts(cwd, branch) { ... }
function getMergeBase(cwd, branchA, branchB) { ... }

// History intelligence
function getRecentCommitPatterns(cwd, count) { ... }
function getFileChangeFrequency(cwd, since) { ... }
```

**Size estimate:** git.js grows from 29 lines to ~150-200 lines. All functions use the existing `execGit()` primitive. No new dependencies.

## Patterns to Follow

### Pattern 1: Lazy Module Loading (router.js)

**What:** New command modules must be lazy-loaded in router.js to avoid parsing all modules at startup.

**Why:** CLI invocations run a single command. Loading all 14+ command modules wastes ~50-100ms.

**Example:**
```javascript
// In router.js — add alongside existing lazy loaders
function lazyAgent() { return _modules.agent || (_modules.agent = require('./commands/agent')); }

// In switch statement
case 'agent': {
  const subcommand = args[1];
  if (subcommand === 'classify-tasks') {
    lazyAgent().cmdAgentClassifyTasks(cwd, args[2], raw);
  } else if (subcommand === 'context-profile') {
    lazyAgent().cmdAgentContextProfile(cwd, args[2], raw);
  }
  // ...
  break;
}
```

### Pattern 2: Advisory-Only Analysis (v2.0 precedent)

**What:** Orchestration recommendations are advisory, never blocking. Workflows decide whether to act on them.

**Why:** The v2.0 state validation decision established this pattern — "Never block workflows; warn and let user decide." Agent routing recommendations follow the same principle.

**Example:**
```javascript
// orchestrator.js returns recommendations, not directives
function classifyTask(planContent) {
  return {
    complexity: 'moderate',
    recommended_model: 'sonnet',        // recommendation, not requirement
    risk_level: 'medium',
    parallelism_safe: true,
    advisory: 'Consider code review for high-fan-in files',  // optional human hint
  };
}
```

### Pattern 3: JSON-Over-Stdout Interface

**What:** All new commands output structured JSON when piped, human-readable when TTY. Use the `output()` function with optional `{ formatter }`.

**Why:** v6.0 established the dual-mode output pattern. Agent consumers (workflows) always pipe to parse JSON. Human users see formatted tables.

**Example:**
```javascript
function cmdAgentClassifyTasks(cwd, phase, raw) {
  const result = classifyPhaseTasks(cwd, phase);
  output(result, {
    formatter: (r) => {
      const lines = [banner('Task Classification')];
      lines.push(formatTable(
        ['Plan', 'Complexity', 'Type', 'Risk', 'Model'],
        r.plans.map(p => [p.plan_id, p.complexity, p.task_type, p.risk_level, p.recommended_model])
      ));
      return lines.join('\n');
    }
  });
}
```

### Pattern 4: Graceful Degradation

**What:** Every new data source in init payloads must degrade gracefully. Missing data → null field, never crash.

**Why:** The `formatCodebaseContext()` pattern in init.js wraps every intelligence source in try/catch, falling back to null. Workflows skip null fields silently.

**Example:**
```javascript
// In cmdInitExecutePhase — adding orchestration data
try {
  const routing = classifyPhaseTasks(cwd, phase);
  result.task_routing = routing;
} catch (e) {
  debugLog('init.executePhase', 'task routing failed (non-blocking)', e);
  result.task_routing = null;
}
```

### Pattern 5: Extensible Registry (conventions.js, lifecycle.js precedent)

**What:** Task type classifiers should use a registry pattern for extensibility.

**Why:** conventions.js uses `FRAMEWORK_DETECTORS` array and lifecycle.js uses `LIFECYCLE_DETECTORS` array. New classifiers can be added by pushing to the registry without modifying existing code.

**Example:**
```javascript
// orchestrator.js
const TASK_CLASSIFIERS = [
  {
    name: 'test-detection',
    detect: (task) => /\b(test|spec|assert|verify)\b/i.test(task.description),
    classify: () => ({ task_type: 'test', recommended_model: 'sonnet' }),
  },
  {
    name: 'refactor-detection',
    detect: (task) => /\b(refactor|rename|extract|move)\b/i.test(task.description),
    classify: () => ({ task_type: 'refactor', recommended_model: 'sonnet' }),
  },
  // ... extensible
];
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Circular Dependencies Between lib/ and commands/

**What:** lib/ modules must never import from commands/. The dependency direction is strictly commands/ → lib/.

**Why bad:** init.js already imports from intent.js and codebase.js (both commands/) via cross-command imports. This is technically allowed (command-to-command) but new lib/ modules must not do this.

**Instead:** If orchestrator.js needs data that currently lives in a command module (e.g., `getIntentSummary` from intent.js), either:
1. Extract the shared logic into a lib/ module
2. Have the command module pass the data as a parameter

### Anti-Pattern 2: Orchestrator Making Execution Decisions

**What:** The orchestrator module should not spawn agents, modify files, or make irreversible decisions.

**Why bad:** Violates the "gsd-tools provides data, workflows act" architecture. If orchestrator.js starts spawning agents, you lose the human-in-the-loop checkpoint and the workflow's ability to override routing.

**Instead:** Return recommendations as JSON. Let workflows decide: `if (routing.plans[0].recommended_model === 'haiku' && user_override === 'quality') use 'opus'`.

### Anti-Pattern 3: Giant Init Payloads

**What:** Adding more and more data to init command output, growing the JSON payload unboundedly.

**Why bad:** Context rot (Anthropic research, Sep 2025). Every additional token in the init payload competes for the workflow agent's attention budget. The init payload for execute-phase already includes: phase info, plans, models, config, branches, worktrees, overlaps, intent, env, codebase stats — 30+ fields.

**Instead:** Use `--compact` (default true since v1.1) aggressively. New orchestration data should be fetched via separate CLI calls (`agent classify-tasks`) rather than bundled into init. The workflow can call both in parallel.

### Anti-Pattern 4: Premature Async Rewrite

**What:** Converting synchronous I/O to async for performance.

**Why bad:** Explicitly out of scope in PROJECT.md: "Async I/O rewrite — Synchronous I/O is appropriate for CLI tool." Each CLI invocation is a short-lived process (<5s). The overhead of async/await in a synchronous pipeline is negative.

**Instead:** Optimize by reducing work (smarter caching, incremental analysis) not by parallelizing I/O within a single command invocation.

## Context Reduction Architecture

### Principle: Operate at Both Levels

Context reduction must work at **two complementary levels**:

**Level 1: CLI Output (gsd-tools.cjs)**
- `--compact` mode (default since v1.1) — field trimming in JSON output
- `--fields` flag (existing) — project only requested fields
- `--manifest` mode — return field names without values (tells agent what's available)
- NEW: `trimPayload()` in profiler.js — progressive disclosure with token budgets

**Level 2: Workflow Markdown**
- Existing: `extract-sections` CLI (dual-boundary parsing, loads only needed sections)
- Existing: `@-reference` pattern (load files on demand, not all upfront)
- NEW: Workflow templates should specify `<context_budget>` tags with token limits
- NEW: Agent prompts should use `<files_to_read>` instead of inlining file content

### Context Reduction Data Flow

```
Workflow prepares agent spawn
  │
  ├─ Measure: gsd-tools agent context-profile {plan}
  │    → Returns: { total_tokens: 45000, budget_percent: 22% }
  │    → Recommendations: ["codebase_context: trim to top 5 deps (saves ~2K tokens)"]
  │
  ├─ If within budget (< 50%): spawn as-is
  │
  ├─ If over budget (> 50%):
  │    ├─ Apply Level 1: use --compact, --fields on CLI calls
  │    ├─ Apply Level 2: use extract-sections instead of full file reads
  │    └─ Re-measure, spawn with trimmed context
  │
  └─ If critically over (> 80%):
       ├─ Split into sub-tasks (multi-agent decomposition)
       └─ Each sub-agent gets focused context window
```

### What NOT to Reduce

Per Anthropic's context engineering guidance (Sep 2025): "the smallest possible set of high-signal tokens." Some context is high-signal and must never be trimmed:
- Plan frontmatter (task list, files_modified, dependencies)
- STATE.md current position
- AGENTS.md project-specific instructions
- The plan's task descriptions themselves

Low-signal targets for reduction:
- Full ROADMAP.md (replace with phase-specific excerpt)
- Full codebase_context (replace with files_modified-scoped deps only)
- Historical decisions in STATE.md (replace with current-phase decisions only)
- Workflow boilerplate instructions (these are cached by the model via system prompt)

## Specialized Agent Roles — Architecture Impact

### New Agent Types

| Agent Role | Workflows That Spawn It | CLI Support Needed | Model Profile |
|-----------|------------------------|-------------------|---------------|
| `gsd-code-reviewer` | execute-phase.md (post-plan verification) | `agent classify-tasks` identifies review-worthy changes | quality: opus, balanced: sonnet, budget: sonnet |
| `gsd-test-generator` | plan-phase.md (plan includes test tasks), execute-plan.md | `codebase context` for test conventions | quality: sonnet, balanced: sonnet, budget: haiku |
| `gsd-refactorer` | execute-phase.md (refactor-type plans) | `codebase deps` for impact analysis | quality: opus, balanced: sonnet, budget: sonnet |
| `gsd-dependency-manager` | plan-phase.md (dependency update plans) | `env scan`, `codebase deps` | quality: sonnet, balanced: haiku, budget: haiku |

### Integration Points

New agents are defined as **markdown files** in the agents/ directory (same as existing pattern). No CLI code changes needed for agent definitions — the CLI only needs to know agent names for model profile resolution.

**Changes needed:**
1. `src/lib/constants.js` — Add new agent names to `MODEL_PROFILES` table
2. `agents/` directory — New `.md` files with system prompts (not in CLI codebase)
3. Workflow files — Updated spawn prompts that route to new agent types based on task classification

**No changes needed:**
- Router — agents are spawned by workflows, not by CLI commands
- Build pipeline — agent .md files are deployed by deploy.sh, not bundled

## Build Order (Respecting Dependencies)

### Phase 1: Foundation (lib modules, no workflow changes)

1. **Extend `src/lib/git.js`** — Add branch management, conflict prediction, history intelligence functions. No new dependencies. Tests against existing git.js test patterns.

2. **Create `src/lib/orchestrator.js`** — Task classification engine. Depends on: helpers.js, frontmatter.js, codebase-intel.js, deps.js, git.js. Test with mock PLAN.md files.

3. **Create `src/lib/profiler.js`** — Context measurement and trimming. Depends on: context.js, helpers.js, config.js. Test with real workflow file measurements.

### Phase 2: CLI Surface (commands + router)

4. **Create `src/commands/agent.js`** — CLI commands exposing orchestrator and profiler. Depends on: orchestrator.js, profiler.js, output.js, format.js. Follows existing command patterns.

5. **Update `src/router.js`** — Add `agent` case with lazy loading. Update help text. Update usage string.

6. **Update `src/lib/constants.js`** — Add new agent types to MODEL_PROFILES table.

### Phase 3: Init Integration (existing command modification)

7. **Extend `src/commands/init.js`** — Inject orchestration metadata (task_routing, context_profile) into init payloads. Advisory only, null fallback.

### Phase 4: Workflow Integration

8. **Update workflow files** — execute-phase.md, plan-phase.md consume new CLI commands for smarter routing. Modify agent spawn prompts to use routing recommendations.

9. **Create agent definition files** — New .md files in agents/ directory with system prompts for specialized roles.

### Phase 5: Context Reduction

10. **Workflow compression** — Apply profiler.js recommendations to reduce workflow template token counts. Measure before/after with `context-budget measure`.

11. **Init payload optimization** — Apply `--compact` improvements, trim low-signal fields from init JSON based on profiler analysis.

### Build Order Rationale

- Phases 1-2 are independent of existing workflows — can be built and tested in isolation
- Phase 3 modifies existing init payloads — requires phase 1-2 to be stable
- Phase 4 requires phases 1-3 to provide data — workflow changes come last
- Phase 5 is a refinement pass — must have working measurement tools (profiler) first
- This order means **no breaking changes** at any point — existing workflows continue to work throughout

## Scalability Considerations

| Concern | Current (v6.0) | At 50 phases | At 500 plans |
|---------|----------------|--------------|-------------|
| CLI startup | ~50ms (lazy loading) | Same — lazy loading | Same |
| Phase tree scan | ~5ms (cached) | ~20ms | ~100ms (consider indexing) |
| Task classification | N/A | ~100ms (read 5-10 plans) | ~500ms (batch by phase) |
| Context profiling | N/A | ~50ms per plan | ~50ms per plan (on-demand) |
| Init payload size | ~3-5KB JSON | ~5-8KB | ~5-8KB (per-phase, not all) |
| Bundle size | 681KB | +15-25KB (2-3 new modules) | Same |

## Module Size Budget

| Module | Estimated Lines | Rationale |
|--------|----------------|-----------|
| `src/lib/orchestrator.js` | 200-300 | Task classifiers + parallelism analysis |
| `src/lib/profiler.js` | 150-250 | Token measurement + reduction logic |
| `src/commands/agent.js` | 200-300 | CLI interface (4-5 subcommands) |
| `src/lib/git.js` extension | +120-170 | 8-10 new helper functions |
| Total new code | ~670-1020 lines | ~5-7% bundle growth |

Consistent with existing module sizes: conventions.js (644), deps.js (697), lifecycle.js (569), helpers.js (946).

## Sources

- Anthropic, "Effective context engineering for AI agents" (Sep 2025) — context rot, progressive disclosure, sub-agent architectures, compaction strategies. HIGH confidence. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, "Building effective agents" — workflow vs agent distinction, tool design principles. HIGH confidence.
- Microsoft Azure Architecture Center, "AI Agent Design Patterns" — supervisor pattern, specialized worker agents, task routing. MEDIUM confidence. https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- Chroma Research, "Context Rot" — empirical evidence that larger contexts degrade LLM recall accuracy. HIGH confidence. https://research.trychroma.com/context-rot
- Existing GSD codebase analysis (src/ modules, workflows/, templates/) — architectural patterns, module boundaries, dependency direction. HIGH confidence (primary source).
- PROJECT.md v7.0 requirements and constraints — out-of-scope items, backward compatibility requirements. HIGH confidence.
