---
description: Group command for configuration operations - settings, profile, validate
---
<objective>
Router command that delegates to specific config workflows based on first argument.

**Usage:**
- /bgsd config → settings
- /bgsd config settings → settings
- /bgsd config profile → set-profile
- /bgsd config validate → cmd-validate-config
</objective>

<execution_context>
Routes to: settings, set-profile, cmd-validate-config
</execution_context>

<context>
$ARGUMENTS: First word is subcommand, rest are passed to target
</context>

<process>
Parse first argument to determine target command, then route.

Subcommands:
- settings → settings
- profile → set-profile
- validate → cmd-validate-config

If no subcommand provided, default to settings.

Route all arguments to the target command unchanged.
</process>
