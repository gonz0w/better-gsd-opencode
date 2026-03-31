# Configuration Reference

Complete reference for all bGSD configuration options. Configuration lives in `.planning/config.json`.

---

## Managing Configuration

```
/bgsd-settings                              # Interactive configuration
/bgsd-settings profile quality              # Quick selected-profile switch
```

Edit `.planning/config.json` directly for scripted changes, then run `/bgsd-settings validate` (or the equivalent config validation command) if you want a contract check.

---

## Full Schema

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_settings": {
    "default_profile": "balanced",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {}
  },
  "commit_docs": true,
  "search_gitignored": false,
  "branching_strategy": "none",
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "research": true,
  "plan_checker": true,
  "verifier": true,
  "parallelization": true,
  "brave_search": false,
  "test_commands": {},
  "test_gate": true,
  "context_window": 200000,
  "context_target_percent": 50,

  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "ci_gate": false
  },

  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },

  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },

  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },

  "worktree": {
    "enabled": false,
    "base_path": "/tmp/bgsd-worktrees",
    "sync_files": [".env", ".env.local", ".planning/config.json"],
    "setup_hooks": [],
    "max_concurrent": 3
  }
}
```

---

## Settings Reference

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mode` | string | `"interactive"` | `"interactive"` confirms each step; `"yolo"` auto-approves human-verify checkpoints |
| `depth` | string | `"standard"` | Planning depth: `"quick"`, `"standard"`, `"deep"` |
| `model_settings` | object | built-in contract | Shared model contract: selected default profile, concrete profile definitions, sparse agent overrides |
| `commit_docs` | boolean | `true` | Auto-commit planning documents to git |
| `search_gitignored` | boolean | `false` | Include gitignored files in searches |

### Model Settings Contract

The normal path is:

1. Pick one selected project profile in `model_settings.default_profile`
2. Define the concrete model behind each built-in profile in `model_settings.profiles`
3. Add `model_settings.agent_overrides` only when one agent should be an exception

```json
{
  "model_settings": {
    "default_profile": "balanced",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {
      "bgsd-executor": "ollama/qwen3-coder:latest"
    }
  }
}
```

### `model_settings.default_profile`

Selects which shared profile the project uses by default. Valid values are `quality`, `balanced`, and `budget`.

### `model_settings.profiles`

Defines the concrete model id behind each built-in profile.

| Profile | Shipped default | Use when |
|---------|-----------------|----------|
| `quality` | `gpt-5.4` | Best reasoning and review quality matter more than speed |
| `balanced` | `gpt-5.4-mini` | Recommended day-to-day default |
| `budget` | `gpt-5.4-nano` | Fastest / lowest-cost routine work |

### `model_settings.agent_overrides`

Optional sparse exceptions keyed by canonical agent id. Each override points directly to a concrete model id.

Example:

```json
{
  "model_settings": {
    "agent_overrides": {
      "bgsd-executor": "ollama/qwen3-coder:latest"
    }
  }
}
```

Resolution order is:

1. `model_settings.agent_overrides[agent]`
2. `model_settings.profiles[model_settings.default_profile].model`
3. Shipped defaults for `quality`, `balanced`, and `budget`

### Branching

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `branching_strategy` | string | `"none"` | `"none"` (all on current branch), `"phase"` (branch per phase), `"milestone"` (branch per milestone) |
| `phase_branch_template` | string | `"gsd/phase-{phase}-{slug}"` | Branch name template for phase strategy |
| `milestone_branch_template` | string | `"gsd/{milestone}-{slug}"` | Branch name template for milestone strategy |

### Agent Toggles

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `research` | boolean | `true` | Run research phase before planning |
| `plan_checker` | boolean | `true` | Enable plan quality review (up to 3 revision cycles) |
| `verifier` | boolean | `true` | Enable phase verification after execution |
| `test_gate` | boolean | `true` | Block execution on test failure |
| `brave_search` | boolean | `false` | Enable web search in research phases |
| `workflow.ci_gate` | boolean | `false` | Run GitHub CI quality gate (push, PR, code scanning, auto-merge) after execution. Also triggered by `--ci` flag on `/bgsd-execute-phase` or `/bgsd-quick` |

### Context Management

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `context_window` | number | `200000` | Model context window size in tokens |
| `context_target_percent` | number | `50` | Target context usage percentage (leave headroom for reasoning) |

### Test Commands

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `test_commands` | object | `{}` | Override auto-detected test commands by language |

Example:
```json
{
  "test_commands": {
    "node": "npm test",
    "elixir": "mix test",
    "python": "pytest"
  }
}
```

### Workflow Gates

Fine-grained control over confirmation prompts:

| Gate | Default | What It Controls |
|------|---------|-----------------|
| `gates.confirm_project` | `true` | Confirm project definition before proceeding |
| `gates.confirm_phases` | `true` | Confirm phase breakdown |
| `gates.confirm_roadmap` | `true` | Confirm full roadmap |
| `gates.confirm_breakdown` | `true` | Confirm task breakdown within plans |
| `gates.confirm_plan` | `true` | Confirm plan before execution |
| `gates.execute_next_plan` | `true` | Confirm before starting next plan in phase |
| `gates.issues_review` | `true` | Review issues before continuing |
| `gates.confirm_transition` | `true` | Confirm phase transition |

In `yolo` mode, most gates auto-approve. `decision` and `human-action` checkpoints always pause.

### Safety Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `safety.always_confirm_destructive` | `true` | Always confirm destructive operations (file deletion, force push) |
| `safety.always_confirm_external_services` | `true` | Always confirm external service calls |

### Parallelization

| Setting | Default | Description |
|---------|---------|-------------|
| `parallelization.enabled` | `true` | Enable parallel plan execution |
| `parallelization.plan_level` | `true` | Parallelize at plan level (within waves) |
| `parallelization.task_level` | `false` | Parallelize at task level (within plans) |
| `parallelization.skip_checkpoints` | `true` | Skip human-verify checkpoints in parallel mode |
| `parallelization.max_concurrent_agents` | `3` | Maximum simultaneous agent spawns |
| `parallelization.min_plans_for_parallel` | `2` | Minimum plans needed to trigger parallel execution |

### Worktree Isolation

| Setting | Default | Description |
|---------|---------|-------------|
| `worktree.enabled` | `false` | Enable git worktree isolation for parallel execution |
| `worktree.base_path` | `"/tmp/bgsd-worktrees"` | Directory for worktree creation |
| `worktree.sync_files` | `[".env", ".env.local", ".planning/config.json"]` | Files copied to each worktree |
| `worktree.setup_hooks` | `[]` | Commands run after worktree creation (e.g., `["npm install"]`) |
| `worktree.max_concurrent` | `3` | Maximum simultaneous worktrees |

## User Defaults

Save preferred settings globally at `~/.gsd/defaults.json`. These are applied when creating new projects via `/bgsd-new-project`.

```json
{
  "model_settings": {
    "default_profile": "quality",
    "profiles": {
      "quality": { "model": "gpt-5.4" },
      "balanced": { "model": "gpt-5.4-mini" },
      "budget": { "model": "gpt-5.4-nano" }
    },
    "agent_overrides": {}
  },
  "mode": "yolo",
  "research": true,
  "plan_checker": true
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GSD_DEBUG` | Enable debug logging (stderr) for all catch blocks |
| `GSD_PROFILE` | Enable performance profiling (`GSD_PROFILE=1`) |

---

*For how configuration affects workflow behavior, see [Workflows](workflows.md). For the full command reference, see [Commands](commands.md).*
