const { resolvePhaseDependencies } = require('../../src/lib/decision-rules');

describe('resolvePhaseDependencies', () => {
  test('returns phases in wave order when no dependencies', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: null },
    ];
    const result = resolvePhaseDependencies({ phases });
    expect(result.value.verification.valid).toBe(true);
    expect(result.value.waves).toEqual({ '1': 1, '2': 1, '3': 1 });
  });

  test('assigns dependents to wave after their dependencies', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: ['1'] },
      { number: '3', depends_on: ['2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    expect(result.value.waves['1']).toBe(1);
    expect(result.value.waves['2']).toBe(2);
    expect(result.value.waves['3']).toBe(3);
  });

  test('parallel phases in same wave when no interdependency', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: ['1', '2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    expect(result.value.waves['1']).toBe(1);
    expect(result.value.waves['2']).toBe(1);
    expect(result.value.waves['3']).toBe(2);
  });

  test('detects cycle and returns valid: false', () => {
    const phases = [
      { number: '1', depends_on: ['3'] },
      { number: '2', depends_on: ['1'] },
      { number: '3', depends_on: ['2'] },
    ];
    const result = resolvePhaseDependencies({ phases });
    expect(result.value.verification.valid).toBe(false);
    expect(result.value.verification.errors[0]).toMatch(/cycle/i);
  });

  test('verification pass catches declared dep ordering violations', () => {
    const phases = [
      { number: '1', depends_on: null },
      { number: '2', depends_on: null },
      { number: '3', depends_on: ['3'] }, // self-reference
    ];
    const result = resolvePhaseDependencies({ phases });
    // Self-reference cycle detected
    expect(result.value.verification.valid).toBe(false);
  });
});
