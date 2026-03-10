---
name: debugger-investigation
description: Investigation techniques for debuggers — binary search, rubber duck debugging, minimal reproduction, working backwards, differential debugging, observability-first, comment-out-everything, git bisect, technique selection guide, and technique composition patterns.
type: agent-specific
agents: [debugger]
sections: [binary-search, rubber-duck, minimal-reproduction, working-backwards, differential-debugging, observability-first, comment-out, git-bisect, technique-selection, combining]
---

## Purpose

The debugger's toolbox of investigation techniques. Each technique is suited to specific situations. The debugger selects the right technique based on the problem characteristics, and often combines multiple techniques in sequence. This is the largest agent-specific skill because investigation techniques are the debugger's primary value.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: binary-search -->
### Binary Search / Divide and Conquer

**When:** Large codebase, long execution path, many possible failure points.

**How:** Cut problem space in half repeatedly until you isolate the issue.

1. Identify boundaries (where works, where fails)
2. Add logging/testing at midpoint
3. Determine which half contains the bug
4. Repeat until you find exact line

**Example:** API returns wrong data
- Data leaves database correctly? YES
- Data reaches frontend correctly? NO
- Data leaves API route correctly? YES
- Data survives serialization? NO
- **Found:** Bug in serialization layer (4 tests eliminated 90% of code)
<!-- /section -->

<!-- section: rubber-duck -->
### Rubber Duck Debugging

**When:** Stuck, confused, mental model doesn't match reality.

**How:** Explain the problem in complete detail:
1. "The system should do X"
2. "Instead it does Y"
3. "I think this is because Z"
4. "The code path is: A → B → C → D"
5. "I've verified that..." (what you tested)
6. "I'm assuming that..." (your assumptions)

Often you'll spot the bug mid-explanation: "Wait, I never verified that B returns what I think it does."
<!-- /section -->

<!-- section: minimal-reproduction -->
### Minimal Reproduction

**When:** Complex system, many moving parts, unclear which part fails.

**How:** Strip away everything until smallest code reproduces the bug.

1. Copy failing code to new file
2. Remove one piece (dependency, function, feature)
3. Test: still reproduces? YES = keep removed. NO = put back.
4. Repeat until bare minimum
5. Bug is now obvious in stripped-down code

```jsx
// Start: 500-line component with 15 props, 8 hooks, 3 contexts
// End:
function MinimalRepro() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(count + 1); // Bug: infinite loop, missing dependency array
  });
  return <div>{count}</div>;
}
```
<!-- /section -->

<!-- section: working-backwards -->
### Working Backwards

**When:** You know correct output, don't know why you're not getting it.

**How:** Start from desired end state, trace backwards.

1. Define desired output precisely
2. What function produces this output?
3. Test that function with expected input — correct output?
   - YES: Bug is earlier (wrong input)
   - NO: Bug is here
4. Repeat backwards through call stack
5. Find divergence point

**Example:** UI shows "User not found" when user exists
```
1. UI displays: user.error → correct field? YES
2. Component receives: user.error = "User not found" → should be null
3. API returns: { error: "User not found" } → Why?
4. DB query: WHERE id = 'undefined' → AH!
5. FOUND: User ID is 'undefined' (string) instead of number
```
<!-- /section -->

<!-- section: differential-debugging -->
### Differential Debugging

**When:** Something used to work and now doesn't. Works in one environment but not another.

**Time-based:** What changed in code, environment, data, configuration since it worked?

**Environment-based:** Compare configuration, env vars, network conditions, data volume, third-party behavior.

**Process:** List differences, test each in isolation, find the difference that causes failure.

**Example:** Works locally, fails in CI
```
Differences:
- Node version: Same ✓
- Env vars: Same ✓
- Timezone: Different! ✗

Test: Set local timezone to UTC (like CI)
Result: Now fails locally too
FOUND: Date comparison assumes local timezone
```
<!-- /section -->

<!-- section: observability-first -->
### Observability First

**When:** Always. Before making any fix.

**Add visibility before changing behavior:**

```javascript
// Strategic logging:
console.log('[handleSubmit] Input:', { email, password: '***' });
console.log('[handleSubmit] Validation:', validationResult);
console.log('[handleSubmit] API response:', response);

// Assertions:
console.assert(user !== null, 'User is null!');

// Timing:
console.time('Database query');
const result = await db.query(sql);
console.timeEnd('Database query');

// Stack traces:
console.log('[updateUser] Called from:', new Error().stack);
```

**Workflow:** Add logging → Run → Observe → Hypothesize → Then change code.
<!-- /section -->

<!-- section: comment-out -->
### Comment Out Everything

**When:** Many possible interactions, unclear which code causes issue.

**How:**
1. Comment out everything in function/file
2. Verify bug is gone
3. Uncomment one piece at a time, testing after each
4. When bug returns, you found the culprit

**Example:** 8 middleware functions, one breaks requests
```javascript
app.use(helmet());       // Uncomment, test → works
app.use(cors());         // Uncomment, test → works
app.use(compression());  // Uncomment, test → works
app.use(bodyParser.json({ limit: '50mb' })); // Uncomment → BREAKS
// FOUND: Body size limit too high causes memory issues
```
<!-- /section -->

<!-- section: git-bisect -->
### Git Bisect

**When:** Feature worked in past, broke at unknown commit.

**How:** Binary search through git history.

```bash
git bisect start
git bisect bad              # Current commit is broken
git bisect good abc123      # This commit worked
# Git checks out middle commit — test and mark good/bad
# Repeat until culprit found
```

100 commits between working and broken: ~7 tests to find exact breaking commit.
<!-- /section -->

<!-- section: technique-selection -->
### Technique Selection Guide

| Situation | Technique |
|-----------|-----------|
| Large codebase, many files | Binary search |
| Confused about what's happening | Rubber duck, Observability first |
| Complex system, many interactions | Minimal reproduction |
| Know the desired output | Working backwards |
| Used to work, now doesn't | Differential debugging, Git bisect |
| Many possible causes | Comment out everything, Binary search |
| Always | Observability first (before making changes) |
<!-- /section -->

<!-- section: combining -->
### Combining Techniques

Techniques compose. Often use multiple together:

1. **Differential debugging** to identify what changed
2. **Binary search** to narrow down where in code
3. **Observability first** to add logging at that point
4. **Rubber duck** to articulate what you're seeing
5. **Minimal reproduction** to isolate the behavior
6. **Working backwards** to find the root cause
<!-- /section -->

## Cross-references

- <skill:debugger-hypothesis-testing /> — How to form and test hypotheses using these techniques
- <skill:debugger-verification /> — Verifying fixes found through investigation

## Examples

See debugger agent's `<investigation_techniques>` section for the original comprehensive reference with additional code examples.
