---
description: Group command for roadmap management - add, insert, remove
---
<objective>
Router command that delegates to specific roadmap workflows based on first argument.

**Usage:**
- /bgsd roadmap add → add-phase
- /bgsd roadmap insert [phase] [position] → insert-phase
- /bgsd roadmap remove [phase] → remove-phase
</objective>

<execution_context>
Routes to: add-phase, insert-phase, remove-phase
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- add → add-phase
- insert → insert-phase
- remove → remove-phase

Route all arguments to the target command unchanged.
</process>
