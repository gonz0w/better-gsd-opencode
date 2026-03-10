---
description: Group command for planning operations - project, discuss, research, assumptions, phase
---
<objective>
Router command that delegates to specific planning workflows based on first argument.

**Usage:**
- /bgsd plan project → new-project
- /bgsd plan discuss [phase] → discuss-phase
- /bgsd plan research [phase] → research-phase
- /bgsd plan assumptions [phase] → list-phase-assumptions
- /bgsd plan phase [phase] → plan-phase
</objective>

<execution_context>
Routes to: new-project, discuss-phase, research-phase, list-phase-assumptions, plan-phase
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- project → new-project
- discuss → discuss-phase  
- research → research-phase
- assumptions → list-phase-assumptions
- phase → plan-phase

Route all arguments to the target command unchanged.
</process>
