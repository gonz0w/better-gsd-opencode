---
name: debugger-verification
description: Debug fix verification methodology — what "verified" means (5 criteria), reproduction verification, regression testing, environment verification, stability testing, test-first debugging, verification checklist, and red flags indicating insufficient verification.
type: agent-specific
agents: [debugger]
sections: [what-verified-means, reproduction, regression, environment, stability, test-first, checklist, red-flags]
---

## Purpose

Ensures bug fixes are actually correct, not just "it seems to work now." Verification is the discipline that separates professional debugging from trial-and-error. A fix isn't done until it passes all five verification criteria.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: what-verified-means -->
### What "Verified" Means

A fix is verified when ALL of these are true:

1. **Original issue no longer occurs** — Exact reproduction steps now produce correct behavior
2. **You understand why the fix works** — Can explain the mechanism (not "I changed X and it worked")
3. **Related functionality still works** — Regression testing passes
4. **Fix works across environments** — Not just on your machine
5. **Fix is stable** — Works consistently, not "worked once"

**Anything less is not verified.**
<!-- /section -->

<!-- section: reproduction -->
### Reproduction Verification

**Golden rule:** If you can't reproduce the bug, you can't verify it's fixed.

- **Before fixing:** Document exact reproduction steps
- **After fixing:** Execute the same steps exactly
- **Test edge cases:** Related scenarios

**If you can't reproduce the original bug:** Revert fix. If bug returns, you've verified the fix addressed it.
<!-- /section -->

<!-- section: regression -->
### Regression Testing

**The problem:** Fix one thing, break another.

**Protection:**
1. Identify adjacent functionality (what else uses the code you changed?)
2. Test each adjacent area
3. Run existing tests (unit, integration, e2e)
<!-- /section -->

<!-- section: environment -->
### Environment Verification

**Differences to consider:** Environment variables, dependencies, data volume, network conditions.

**Checklist:**
- [ ] Works in development
- [ ] Works in Docker (mimics production)
- [ ] Works in staging (production-like)
- [ ] Works in production (the real test)
<!-- /section -->

<!-- section: stability -->
### Stability Testing

**For intermittent bugs:**

```bash
# Repeated execution
for i in {1..100}; do
  npm test -- specific-test.js || echo "Failed on run $i"
done
```

If it fails even once, it's not fixed.

**Race condition testing:** Add random delays between operations to expose timing bugs. Run thousands of times.
<!-- /section -->

<!-- section: test-first -->
### Test-First Debugging

Write a failing test that reproduces the bug, then fix until the test passes.

**Benefits:** Proves reproduction, provides automatic verification, prevents regression forever, forces precise understanding.

```javascript
// 1. Write test reproducing bug
test('handles undefined user data', () => {
  const result = processUserData(undefined);
  expect(result).toBe(null); // Currently throws
});

// 2. Verify test fails (confirms reproduction)
// 3. Fix the code
// 4. Verify test passes
// 5. Test is now permanent regression protection
```
<!-- /section -->

<!-- section: checklist -->
### Verification Checklist

**Original Issue:**
- [ ] Can reproduce original bug before fix
- [ ] Documented exact reproduction steps

**Fix Validation:**
- [ ] Original steps now work correctly
- [ ] Can explain WHY the fix works
- [ ] Fix is minimal and targeted

**Regression Testing:**
- [ ] Adjacent features work
- [ ] Existing tests pass
- [ ] Added test to prevent regression

**Stability Testing:**
- [ ] Tested multiple times, zero failures
- [ ] Tested edge cases
<!-- /section -->

<!-- section: red-flags -->
### Verification Red Flags

**Your verification might be wrong if:**
- Can't reproduce original bug anymore (forgot how, environment changed)
- Fix is large or complex (too many moving parts)
- Not sure why it works
- Only works sometimes ("seems more stable")

**Red flag phrases:** "It seems to work", "I think it's fixed", "Looks good to me"

**Trust-building phrases:** "Verified 50 times — zero failures", "All tests pass including new regression test", "Root cause was X, fix addresses X directly"

**Mindset:** Assume your fix is wrong until proven otherwise. This isn't pessimism — it's professionalism.
<!-- /section -->

## Cross-references

- <skill:debugger-hypothesis-testing /> — Hypotheses inform what to verify

## Examples

See debugger agent's `<verification_patterns>` section for the original comprehensive reference with stability testing code examples.
