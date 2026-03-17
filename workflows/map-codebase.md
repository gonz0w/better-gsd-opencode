<purpose>
Orchestrate 4 parallel codebase mapper agents (tech, arch, quality, concerns) to write 7 structured documents to .planning/codebase/. Agents write directly; orchestrator only receives confirmations and line counts.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>

<!-- section: init_context -->
<skill:bgsd-context-init />

Extract from `<bgsd-context>` JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`.
<!-- /section -->

<!-- section: check_existing -->
<step name="check_existing">
If `codebase_dir_exists` is true, run `ls -la .planning/codebase/` and offer:

| Choice | Action |
|--------|--------|
| Refresh | Delete .planning/codebase/, continue to create_structure |
| Update | Ask which documents to update, continue to spawn_agents (filtered) |
| Skip | Exit workflow |

Wait for user response. If doesn't exist: continue to create_structure.
</step>
<!-- /section -->

<!-- section: create_structure -->
<step name="create_structure">
```bash
mkdir -p .planning/codebase
```

Expected output: STACK.md, INTEGRATIONS.md (tech), ARCHITECTURE.md, STRUCTURE.md (arch), CONVENTIONS.md, TESTING.md (quality), CONCERNS.md (concerns).
</step>
<!-- /section -->

<!-- section: spawn_agents -->
<step name="spawn_agents">
Spawn 4 parallel bgsd-codebase-mapper agents with `run_in_background=true`. Use `subagent_type="bgsd-codebase-mapper"`, NOT `Explore`.

**Dimensions and outputs:**

| Agent | Focus | Documents |
|-------|-------|-----------|
| 1 | tech | STACK.md (languages, runtime, deps, config), INTEGRATIONS.md (external APIs, databases, auth) |
| 2 | arch | ARCHITECTURE.md (pattern, layers, data flow, entry points), STRUCTURE.md (directory layout, naming) |
| 3 | quality | CONVENTIONS.md (code style, naming, error handling), TESTING.md (framework, mocking, coverage) |
| 4 | concerns | CONCERNS.md (tech debt, bugs, security, performance, fragile areas) |

Each Task call:
```
Task(
  subagent_type="bgsd-codebase-mapper",
  model="{mapper_model}",
  run_in_background=true,
  description="Map codebase {focus}",
  prompt="Focus: {focus}

Analyze this codebase for {description}.

Write these documents to .planning/codebase/:
{document list with brief description}

Explore thoroughly. Write documents directly using templates. Return confirmation only."
)
```
</step>
<!-- /section -->

<!-- section: collect_confirmations -->
<step name="collect_confirmations">
Wait for all 4 agents. Each returns:
```
## Mapping Complete
Focus: {focus}
Documents written:
- .planning/codebase/{DOC}.md ({N} lines)
```

If any agent failed, note and continue with successful documents.
</step>
<!-- /section -->

<!-- section: verify_output -->
<step name="verify_output">
```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

Verify: all 7 documents exist, none empty (>20 lines each). Note any missing.
</step>
<!-- /section -->

<!-- section: scan_secrets -->
<step name="scan_for_secrets">
**CRITICAL SECURITY CHECK** before committing:

```bash
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' .planning/codebase/*.md 2>/dev/null && SECRETS_FOUND=true || SECRETS_FOUND=false
```

If `SECRETS_FOUND=true`: alert user, show matches, pause and wait for "safe to proceed" before committing.
</step>
<!-- /section -->

<!-- section: commit -->
<step name="commit_codebase_map">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs: map existing codebase" --files .planning/codebase/*.md
```
</step>
<!-- /section -->

<!-- section: offer_next -->
<step name="offer_next">
```bash
wc -l .planning/codebase/*.md
```

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues

---

## ▶ Next Up

**Initialize project** — use codebase context for planning

`/bgsd-new-project`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:** Re-run `/bgsd-map-codebase` | Review `cat .planning/codebase/STACK.md`

---
```
</step>
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] 4 parallel bgsd-codebase-mapper agents spawned with run_in_background=true
- [ ] Agents write documents directly (orchestrator doesn't receive document contents)
- [ ] All 7 codebase documents exist
- [ ] Secret scan passes before commit
- [ ] Clear completion summary with line counts
- [ ] User offered clear next steps
</success_criteria>
<!-- /section -->
