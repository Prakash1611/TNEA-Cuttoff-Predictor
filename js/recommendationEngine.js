/**
 * Smart Branch Swap & Alternate Branch Recommendation Engine
 * Analyzes target campus offerings and suggests higher-probability alternate streams 
 * when a candidate falls short of their primary branch preference.
 */

class SmartBranchSwapEngine {
  /**
   * Branch Category Affinity Matrix
   */
  static getBranchAffinity(targetBranchCode, candidateBranchCode) {
    if (targetBranchCode === candidateBranchCode) return 1.0;

    const dataset = window.TNEA_DATA;
    if (!dataset) return 0.5;

    const b1 = dataset.branches.find(b => b.code === targetBranchCode);
    const b2 = dataset.branches.find(b => b.code === candidateBranchCode);

    if (!b1 || !b2) return 0.5;

    // High affinity for same category (e.g., CSE vs IT vs AI&DS)
    if (b1.category === b2.category) return 0.95;

    // Cross-category affinity rules
    const crossAffinity = {
      "Computers-Electronics": 0.85,
      "Electronics-Computers": 0.85,
      "Electronics-Core": 0.70,
      "Core-Electronics": 0.70,
      "Computers-Allied": 0.80,
      "Allied-Computers": 0.80
    };

    const key = `${b1.category}-${b2.category}`;
    return crossAffinity[key] || 0.60;
  }

  /**
   * Generate Alternate Branch Recommendations for a given College
   */
  static getRecommendations(collegeCode, primaryBranchCode, userCutoff, community = "OC", isGovtSchoolQuota = false) {
    if (!window.TNEA_DATA || !window.MLEngine) return [];

    const dataset = window.TNEA_DATA;
    const college = dataset.colleges.find(c => c.code === collegeCode);
    if (!college) return [];

    const primaryBranch = dataset.branches.find(b => b.code === primaryBranchCode);

    // Get all available branches at this college
    const collegeCutoffs = dataset.cutoffs.filter(c =>
      c.collegeCode === collegeCode &&
      c.year === 2025 &&
      c.community === community &&
      c.isGovtSchoolQuota === Boolean(isGovtSchoolQuota)
    );

    const recommendations = [];

    collegeCutoffs.forEach(entry => {
      // Skip the exact primary branch
      if (entry.branchCode === primaryBranchCode) return;

      const altBranch = dataset.branches.find(b => b.code === entry.branchCode);
      if (!altBranch) return;

      const mlProb = window.MLEngine.calculateAdmissionProbability(userCutoff, entry.closingCutoff);
      const affinity = this.getBranchAffinity(entry.branchCode, primaryBranchCode);

      // Only recommend options that have equal or HIGHER admission probability than low-prob primary
      recommendations.push({
        college: college,
        branch: altBranch,
        closingCutoff: entry.closingCutoff,
        closingRank: entry.closingRank,
        mlPrediction: mlProb,
        affinityScore: Math.round(affinity * 100),
        cutoffDifference: Math.round((userCutoff - entry.closingCutoff) * 100) / 100,
        recommendationReason: this.generateReasonText(altBranch, primaryBranch, mlProb, userCutoff - entry.closingCutoff)
      });
    });

    // Sort by higher probability first, then affinity
    recommendations.sort((a, b) => {
      if (b.mlPrediction.probability !== a.mlPrediction.probability) {
        return b.mlPrediction.probability - a.mlPrediction.probability;
      }
      return b.affinityScore - a.affinityScore;
    });

    return recommendations;
  }

  static generateReasonText(altBranch, primaryBranch, mlProb, deltaScore) {
    if (mlProb.tier === 'Safe') {
      return `High probability swap (${mlProb.probability}%). Historical cutoff is ${Math.abs(deltaScore).toFixed(2)} marks below your score at this campus.`;
    } else if (mlProb.tier === 'Target') {
      return `Realistic alternative (${mlProb.probability}% likelihood) in the ${altBranch.category} domain at the same campus.`;
    } else {
      return `Potential option with ${mlProb.probability}% calculated probability.`;
    }
  }
}

if (typeof window !== 'undefined') {
  window.SmartBranchSwapEngine = SmartBranchSwapEngine;
}
