---
description: Group command for todo operations - add, check
---
<objective>
Router command that delegates to specific todo workflows based on first argument.

**Usage:**
- /bgsd todo add [task] → add-todo
- /bgsd todo check → check-todos
</objective>

<execution_context>
Routes to: add-todo, check-todos
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- add → add-todo
- check → check-todos

Route all arguments to the target command unchanged.
</process>
