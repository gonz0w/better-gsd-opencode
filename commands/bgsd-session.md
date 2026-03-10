---
description: Group command for session operations - resume, pause, progress
---
<objective>
Router command that delegates to specific session workflows based on first argument.

**Usage:**
- /bgsd session resume → resume-project
- /bgsd session pause → pause-work
- /bgsd session progress → progress
</objective>

<execution_context>
Routes to: resume-project, pause-work, progress
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- resume → resume-project
- pause → pause-work
- progress → progress

Route all arguments to the target command unchanged.
</process>
