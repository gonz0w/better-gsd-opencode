# Command Consolidation Documentation

This document tracks the command consolidation effort for bGSD slash commands.

## Overview

**Purpose:** Organize 41 commands into logical subcommand groups to reduce cognitive load and simplify command discovery.

**New Command Structure:**
- `/bgsd plan <subcommand>` - Planning operations
- `/bgsd exec <subcommand>` - Execution operations
- `/bgsd roadmap <subcommand>` - Roadmap management
- `/bgsd milestone <subcommand>` - Milestone operations
- `/bgsd session <subcommand>` - Session management
- `/bgsd debug <subcommand>` - Debugging operations
- `/bgsd todo <subcommand>` - Todo operations
- `/bgsd config <subcommand>` - Configuration operations
- `/bgsd util <subcommand>` - Utility operations

## Command Categories and Mappings

### Planning Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-plan-phase [phase]` | `/bgsd plan phase [phase]` | Superseded |
| `/bgsd-new-project` | `/bgsd plan project` | Superseded |
| `/bgsd-discuss-phase [phase]` | `/bgsd plan discuss [phase]` | Superseded |
| `/bgsd-research-phase [phase]` | `/bgsd plan research [phase]` | Superseded |
| `/bgsd-list-phase-assumptions [phase]` | `/bgsd plan assumptions [phase]` | Superseded |

### Execution Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-execute-phase [phase]` | `/bgsd exec phase [phase]` | Superseded |
| `/bgsd-quick` | `/bgsd exec quick` | Superseded |
| `/bgsd-github-ci` | `/bgsd exec ci` | Superseded |

### Roadmap Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-add-phase` | `/bgsd roadmap add` | Superseded |
| `/bgsd-insert-phase [phase] [position]` | `/bgsd roadmap insert [phase] [position]` | Superseded |
| `/bgsd-remove-phase [phase]` | `/bgsd roadmap remove [phase]` | Superseded |

### Milestone Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-new-milestone` | `/bgsd milestone new` | Superseded |
| `/bgsd-complete-milestone` | `/bgsd milestone complete` | Superseded |
| `/bgsd-audit-milestone` | `/bgsd milestone audit` | Superseded |
| `/bgsd-plan-milestone-gaps` | `/bgsd milestone gaps` | Superseded |

### Session Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-resume-work` | `/bgsd session resume` | Superseded |
| `/bgsd-pause-work` | `/bgsd session pause` | Superseded |
| `/bgsd-progress` | `/bgsd session progress` | Superseded |

### Debug Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-debug [context]` | `/bgsd debug [context]` | Wrapper available |
| `/bgsd-verify-work [phase]` | `/bgsd verify [phase]` | Superseded |

### Todo Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-add-todo [task]` | `/bgsd todo add [task]` | Superseded |
| `/bgsd-check-todos` | `/bgsd todo check` | Superseded |

### Config Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-settings` | `/bgsd config` or `/bgsd config settings` | Superseded |
| `/bgsd-set-profile` | `/bgsd config profile` | Superseded |
| `/bgsd-validate-config` | `/bgsd config validate` | Superseded |

### Utility Commands

| Old Command | New Mapping | Status |
|-------------|-------------|--------|
| `/bgsd-map-codebase` | `/bgsd util map` | Superseded |
| `/bgsd-cleanup` | `/bgsd util cleanup` | Superseded |
| `/bgsd-help` | `/bgsd util help` | Superseded |
| `/bgsd-update` | `/bgsd util update` | Superseded |
| `/bgsd-velocity` | `/bgsd util velocity` | Superseded |
| `/bgsd-validate-deps` | `/bgsd util validate-deps` | Superseded |
| `/bgsd-test-run` | `/bgsd util test-run` | Superseded |
| `/bgsd-trace-requirement [id]` | `/bgsd util trace [id]` | Superseded |
| `/bgsd-search-decisions [query]` | `/bgsd util search-decisions [query]` | Superseded |
| `/bgsd-search-lessons [query]` | `/bgsd util search-lessons [query]` | Superseded |
| `/bgsd-session-diff` | `/bgsd util session-diff` | Superseded |
| `/bgsd-rollback-info` | `/bgsd util rollback-info` | Superseded |
| `/bgsd-context-budget` | `/bgsd util context-budget` | Superseded |
| `/bgsd-codebase-impact` | `/bgsd util impact` | Superseded |
| `/bgsd-reapply-patches` | `/bgsd util patches` | Superseded |
| `/bgsd-health` | `/bgsd util health` | Superseded |

## Internal-Only Commands

The following commands should NOT be exposed as slash commands:

| Command | Reason |
|---------|--------|
| `bgsd-notifications.md` | Internal implementation detail, used by plugin hooks |

## Commands to Remove (Post-Transition)

After the transition period, these commands can be removed:

1. All 41 original commands listed above (marked as "Superseded")

## Backward Compatibility

The old commands continue to work during the transition period. The new subcommand wrappers provide:
- Better command discovery (grouped by function)
- Reduced cognitive load (fewer top-level commands to remember)
- Consistent command structure

## Transition Strategy

1. **Phase 1 (This Plan):** Create wrapper commands (DONE)
2. **Phase 2:** Document new command structure
3. **Phase 3:** After user transition, remove old commands

## Summary

- **Original commands:** 41
- **New wrapper commands:** 9
- **Commands to remove after transition:** 41
- **Internal-only commands:** 1 (bgsd-notifications.md)
