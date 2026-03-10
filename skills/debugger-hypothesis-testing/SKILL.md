---
name: debugger-hypothesis-testing
description: Scientific hypothesis testing methodology for debuggers — forming falsifiable hypotheses, experimental design framework, evidence quality assessment, decision criteria for acting, recovery from wrong hypotheses, and multiple competing hypotheses strategy.
type: agent-specific
agents: [debugger]
sections: [falsifiability, forming-hypotheses, experimental-design, evidence-quality, decision-point, recovery, multiple-hypotheses, pitfalls]
---

## Purpose

The debugger's core diagnostic methodology. Every bug investigation follows the scientific method: observe → hypothesize → test → conclude. This skill enforces rigor — no "let me try changing this and see" debugging. Hypotheses must be specific, falsifiable, and tested one at a time.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: falsifiability -->
### Falsifiability Requirement

A good hypothesis can be proven wrong. If you can't design an experiment to disprove it, it's not useful.

**Bad (unfalsifiable):**
- "Something is wrong with the state"
- "The timing is off"
- "There's a race condition somewhere"

**Good (falsifiable):**
- "User state resets because component remounts on route change"
- "API call completes after unmount, causing state update on unmounted component"
- "Two async operations modify same array without locking, causing data loss"

**The difference:** Specificity. Good hypotheses make specific, testable claims.
<!-- /section -->

<!-- section: forming-hypotheses -->
### Forming Hypotheses

1. **Observe precisely:** Not "it's broken" but "counter shows 3 when clicking once, should show 1"
2. **Ask "What could cause this?"** — List every possible cause (don't judge yet)
3. **Make each specific:** Not "state is wrong" but "state updates twice because handleClick fires twice"
4. **Identify evidence:** What would support/refute each hypothesis?
<!-- /section -->

<!-- section: experimental-design -->
### Experimental Design Framework

For each hypothesis:

1. **Prediction:** If H is true, I will observe X
2. **Test setup:** What do I need to do?
3. **Measurement:** What exactly am I measuring?
4. **Success criteria:** What confirms H? What refutes H?
5. **Run:** Execute the test
6. **Observe:** Record what actually happened
7. **Conclude:** Does this support or refute H?

**One hypothesis at a time.** If you change three things and it works, you don't know which fixed it.
<!-- /section -->

<!-- section: evidence-quality -->
### Evidence Quality

**Strong evidence:**
- Directly observable ("I see in logs that X happens")
- Repeatable ("This fails every time I do Y")
- Unambiguous ("The value is definitely null, not undefined")
- Independent ("Happens even in fresh browser with no cache")

**Weak evidence:**
- Hearsay ("I think I saw this fail once")
- Non-repeatable ("It failed that one time")
- Ambiguous ("Something seems off")
- Confounded ("Works after restart AND cache clear AND package update")
<!-- /section -->

<!-- section: decision-point -->
### Decision Point: When to Act

Act when you can answer YES to all:
1. **Understand the mechanism?** Not just "what fails" but "why it fails"
2. **Reproduce reliably?** Either always reproduces, or you understand trigger conditions
3. **Have evidence, not just theory?** You've observed directly, not guessing
4. **Ruled out alternatives?** Evidence contradicts other hypotheses

**Don't act if:** "I think it might be X" or "Let me try changing Y and see."
<!-- /section -->

<!-- section: recovery -->
### Recovery from Wrong Hypotheses

When disproven:
1. **Acknowledge explicitly** — "This hypothesis was wrong because [evidence]"
2. **Extract the learning** — What did this rule out? What new information?
3. **Revise understanding** — Update mental model
4. **Form new hypotheses** — Based on what you now know
5. **Don't get attached** — Being wrong quickly is better than being wrong slowly
<!-- /section -->

<!-- section: multiple-hypotheses -->
### Multiple Hypotheses Strategy

Don't fall in love with your first hypothesis. Generate alternatives.

**Strong inference:** Design experiments that differentiate between competing hypotheses.

```javascript
// Problem: Form submission fails intermittently
// Competing: network timeout, validation, race condition, rate limiting

try {
  console.log('[1] Starting validation');
  const validation = await validate(formData);
  console.log('[1] Validation passed:', validation);

  console.log('[2] Starting submission');
  const response = await api.submit(formData);
  console.log('[2] Response received:', response.status);

  console.log('[3] Updating UI');
  updateUI(response);
  console.log('[3] Complete');
} catch (error) {
  console.log('[ERROR] Failed at stage:', error);
}

// Observe: Fails at [2] with timeout → Network
// Fails at [1] → Validation. Succeeds but [3] wrong → Race condition
// Fails at [2] with 429 → Rate limiting
// One experiment, differentiates four hypotheses.
```
<!-- /section -->

<!-- section: pitfalls -->
### Hypothesis Testing Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing multiple at once | Changed three things — which fixed it? | Test one hypothesis at a time |
| Confirmation bias | Only looking for supporting evidence | Actively seek disconfirming evidence |
| Acting on weak evidence | "It seems like maybe..." | Wait for strong, unambiguous evidence |
| Not documenting results | Forget what tested, repeat experiments | Write down each hypothesis and result |
| Abandoning rigor under pressure | "Let me just try this..." | Double down on method when pressure increases |
<!-- /section -->

## Cross-references

- <skill:debugger-investigation /> — Investigation techniques to test hypotheses

## Examples

See debugger agent's `<hypothesis_testing>` section for the original comprehensive reference with additional code examples.
