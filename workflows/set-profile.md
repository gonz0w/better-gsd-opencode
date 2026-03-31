<purpose>
Quickly switch the selected project default profile used by bGSD agents. This changes which shared profile the project uses by default without rewriting the concrete models behind `quality`, `balanced`, or `budget`.
</purpose>

<required_reading>
Read all execution_context files before starting.
</required_reading>

<process>

<step name="validate">
Validate argument:

```
if $ARGUMENTS.profile not in ["quality", "balanced", "budget"]:
  Error: Invalid profile "$ARGUMENTS.profile"
  Valid profiles: quality, balanced, budget
  EXIT
```
</step>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-ensure-section
INIT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state load)
```

This creates `.planning/config.json` with defaults if missing and loads current config.
</step>

<step name="update_config">
Read current config from state load or directly:

Update `model_settings.default_profile`:
```json
{
  "model_settings": {
    "default_profile": "$ARGUMENTS.profile"
  }
}
```

Preserve the existing concrete profile definitions and any sparse `agent_overrides` entries.

Write updated config back to `.planning/config.json`.
</step>

<step name="confirm">
Display confirmation with the selected profile and the concrete model currently behind it:

```
✓ Project default profile set to: $ARGUMENTS.profile

Most agents will now use the `$ARGUMENTS.profile` shared profile.

Concrete model for that profile:

| Profile | Model |
|---------|-------|
| $ARGUMENTS.profile | {model_settings.profiles[$ARGUMENTS.profile].model} |

Sparse overrides stay unchanged:

| Agent Override | Result |
|----------------|--------|
| Any configured override | Continues using its direct concrete model |
| No override | Uses the project default profile above |

Example:
| Profile | Model |
|---------|-------|
| quality | gpt-5.4 |

Next spawned agents will use the new profile.
```
</step>

</process>

<success_criteria>
- [ ] Argument validated
- [ ] Config file ensured
- [ ] Config updated with new `model_settings.default_profile`
- [ ] Confirmation displayed with selected profile, concrete model, and override behavior
</success_criteria>
