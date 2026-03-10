---
description: Group command for execution operations - phase, quick, ci
---
<objective>
Router command that delegates to specific execution workflows based on first argument.

**Usage:**
- /bgsd exec phase [phase] → execute-phase
- /bgsd exec quick → quick
- /bgsd exec ci → github-ci
</objective>

<execution_context>
Routes to: execute-phase, quick, github-ci
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- phase → execute-phase
- quick → quick
- ci → github-ci

Route all arguments to the target command unchanged.
</process>
