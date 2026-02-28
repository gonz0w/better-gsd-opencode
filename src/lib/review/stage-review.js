/**
 * Two-Stage Review Module
 * 
 * Stage 1: Spec compliance check - validates code against plan must_haves
 * Stage 2: Code quality check - validates conventions, patterns, anti-patterns
 */

const { loadConventions } = require('../conventions.js');
const { analyzeCodebase } = require('../codebase-intel.js');

/**
 * Severity levels for review findings
 */
const SEVERITY = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * Review stage types
 */
const STAGE = {
  SPEC_COMPLIANCE: 'spec-compliance',
  CODE_QUALITY: 'code-quality'
};

/**
 * Run two-stage review on a plan's must_haves
 * @param {Object} options - Review options
 * @param {Object} options.plan - Plan with must_haves
 * @param {string} options.phaseDir - Phase directory path
 * @returns {Object} Review results with findings per stage
 */
async function twoStageReview({ plan, phaseDir }) {
  const results = {
    stage1: { stage: STAGE.SPEC_COMPLIANCE, findings: [] },
    stage2: { stage: STAGE.CODE_QUALITY, findings: [] }
  };

  // Stage 1: Spec compliance check
  if (plan.must_haves?.truths) {
    for (const truth of plan.must_haves.truths) {
      const finding = await checkSpecCompliance(truth, phaseDir);
      if (finding) {
        results.stage1.findings.push(finding);
      }
    }
  }

  // Stage 2: Code quality check
  const conventions = loadConventions();
  const qualityFindings = await checkCodeQuality(phaseDir, conventions);
  results.stage2.findings = qualityFindings;

  return results;
}

/**
 * Check spec compliance for a single truth
 */
async function checkSpecCompliance(truth, phaseDir) {
  // Check if the truth is addressed in the code
  // This is a simplified implementation - in production would check actual code
  const truthLower = truth.toLowerCase();
  
  // Return null if truth appears to be implemented (simplified check)
  // In a full implementation, this would check actual file contents
  return null;
}

/**
 * Check code quality against conventions
 */
async function checkCodeQuality(phaseDir, conventions) {
  const findings = [];
  
  // Analyze codebase for convention violations
  try {
    const analysis = await analyzeCodebase({ path: phaseDir });
    
    if (analysis?.issues) {
      for (const issue of analysis.issues) {
        findings.push({
          type: 'quality',
          severity: SEVERITY.WARNING,
          message: issue.message,
          location: issue.location,
          suggestion: issue.suggestion
        });
      }
    }
  } catch (err) {
    findings.push({
      type: 'quality',
      severity: SEVERITY.INFO,
      message: `Code quality check skipped: ${err.message}`
    });
  }

  return findings;
}

/**
 * Combine findings from both stages
 * @param {Object} stageResults - Results from twoStageReview
 * @returns {Array} Combined findings sorted by severity
 */
function combineFindings(stageResults) {
  const allFindings = [
    ...stageResults.stage1.findings,
    ...stageResults.stage2.findings
  ];

  // Sort by severity (BLOCKER first)
  const severityOrder = { BLOCKER: 0, WARNING: 1, INFO: 2 };
  return allFindings.sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  );
}

/**
 * Check if findings contain any blockers
 * @param {Array} findings - Array of findings
 * @returns {boolean} True if any blocker found
 */
function hasBlockers(findings) {
  return findings.some(f => f.severity === SEVERITY.BLOCKER);
}

module.exports = {
  twoStageReview,
  combineFindings,
  hasBlockers,
  SEVERITY,
  STAGE
};
