---
description: Group command for utility operations - map, cleanup, help, update, velocity, and more
---
<objective>
Router command that delegates to specific utility workflows based on first argument.

**Usage:**
- /bgsd util map → map-codebase
- /bgsd util cleanup → cleanup
- /bgsd util help → help
- /bgsd util update → update
- /bgsd util velocity → cmd-velocity
- /bgsd util validate-deps → cmd-validate-deps
- /bgsd util test-run → cmd-test-run
- /bgsd util trace [req] → cmd-trace-requirement
- /bgsd util search-decisions [query] → cmd-search-decisions
- /bgsd util search-lessons [query] → cmd-search-lessons
- /bgsd util session-diff → cmd-session-diff
- /bgsd util rollback-info → cmd-rollback-info
- /bgsd util context-budget → cmd-context-budget
- /bgsd util impact → cmd-codebase-impact
- /bgsd util patches → cleanup
- /bgsd util health → health
</objective>

<execution_context>
Routes to: map-codebase, cleanup, help, update, cmd-velocity, cmd-validate-deps, cmd-test-run, cmd-trace-requirement, cmd-search-decisions, cmd-search-lessons, cmd-session-diff, cmd-rollback-info, cmd-context-budget, cmd-codebase-impact, health
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- map → map-codebase
- cleanup → cleanup
- help → help
- update → update
- velocity → cmd-velocity
- validate-deps → cmd-validate-deps
- test-run → cmd-test-run
- trace → cmd-trace-requirement
- search-decisions → cmd-search-decisions
- search-lessons → cmd-search-lessons
- session-diff → cmd-session-diff
- rollback-info → cmd-rollback-info
- context-budget → cmd-context-budget
- impact → cmd-codebase-impact
- patches → cleanup
- health → health

Route all arguments to the target command unchanged.
</process>
