/**
 * DoTE Choice List Generator & Strategy Optimizer
 * Provides One-Click Strategy Builder, Order Validation Rules, and 
 * Official DoTE Portal Option Entry Exporters.
 */

class ChoiceListOptimizer {
  constructor() {
    this.storageKey = 'tnea_choice_list_v1';
    this.choices = this.loadChoices();
  }

  loadChoices() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load saved choices:', e);
      return [];
    }
  }

  saveChoices() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.choices));
    } catch (e) {
      console.error('Failed to save choices:', e);
    }
  }

  getChoices() {
    return this.choices;
  }

  addChoice(item) {
    // Prevent duplicate collegeCode + branchCode
    const exists = this.choices.some(c => 
      c.collegeCode === item.collegeCode && c.branchCode === item.branchCode
    );

    if (exists) {
      return { success: false, message: 'This college & branch combination is already in your choice list!' };
    }

    this.choices.push({
      id: `${item.collegeCode}_${item.branchCode}_${Date.now()}`,
      collegeCode: item.collegeCode,
      collegeName: item.collegeName,
      district: item.district,
      branchCode: item.branchCode,
      branchName: item.branchName,
      closingCutoff: item.closingCutoff,
      closingRank: item.closingRank,
      probability: item.probability,
      tierTag: item.tierTag,
      addedAt: new Date().toISOString()
    });

    this.saveChoices();
    return { success: true, message: 'Choice added successfully!' };
  }

  removeChoice(id) {
    this.choices = this.choices.filter(c => c.id !== id);
    this.saveChoices();
  }

  clearChoices() {
    this.choices = [];
    this.saveChoices();
  }

  moveChoice(index, direction) {
    if (direction === 'up' && index > 0) {
      const temp = this.choices[index];
      this.choices[index] = this.choices[index - 1];
      this.choices[index - 1] = temp;
    } else if (direction === 'down' && index < this.choices.length - 1) {
      const temp = this.choices[index];
      this.choices[index] = this.choices[index + 1];
      this.choices[index + 1] = temp;
    }
    this.saveChoices();
  }

  /**
   * One-Click Strategy Builder
   * Auto-generates a balanced choice sequence (5 Reach, 10 Target, 10 Safe)
   */
  generateStrategyList(predictions, config = { reachCount: 5, targetCount: 10, safeCount: 10 }) {
    const reachMatches = predictions.filter(p => p.mlPrediction.tier === 'Reach');
    const targetMatches = predictions.filter(p => p.mlPrediction.tier === 'Target');
    const safeMatches = predictions.filter(p => p.mlPrediction.tier === 'Safe');

    // Pick top items from each category sorted by college cutoffs
    const selectedReach = reachMatches.slice(0, config.reachCount);
    const selectedTarget = targetMatches.slice(0, config.targetCount);
    const selectedSafe = safeMatches.slice(0, config.safeCount);

    const newChoices = [];

    // Order strategically: Reach -> Target -> Safe
    const combined = [...selectedReach, ...selectedTarget, ...selectedSafe];

    combined.forEach(item => {
      newChoices.push({
        id: `${item.college.code}_${item.branch.code}_${Math.random().toString(36).substr(2, 9)}`,
        collegeCode: item.college.code,
        collegeName: item.college.name,
        district: item.college.district,
        branchCode: item.branch.code,
        branchName: item.branch.name,
        closingCutoff: item.closingCutoff,
        closingRank: item.closingRank,
        probability: item.mlPrediction.probability,
        tierTag: item.mlPrediction.tier,
        addedAt: new Date().toISOString()
      });
    });

    this.choices = newChoices;
    this.saveChoices();
    return this.choices;
  }

  /**
   * Validate Choice Order Strategy
   */
  validateStrategy() {
    const warnings = [];
    
    if (this.choices.length === 0) {
      return { isValid: true, warnings: ["Your choice list is currently empty."] };
    }

    let seenSafe = false;
    let seenTarget = false;

    this.choices.forEach((choice, idx) => {
      if (choice.tierTag === 'Safe') seenSafe = true;
      if (choice.tierTag === 'Target') seenTarget = true;

      // Warning if a Reach choice is placed below a Safe choice
      if (seenSafe && choice.tierTag === 'Reach') {
        warnings.push({
          index: idx + 1,
          type: 'danger',
          text: `Choice #${idx + 1} (${choice.collegeCode} - ${choice.branchCode}) is a Reach option placed BELOW a Safe option. In DoTE counseling, if your Safe choice matches first, you will miss out on this Reach option!`
        });
      }
    });

    // Check for duplicate colleges
    const codes = this.choices.map(c => `${c.collegeCode}_${c.branchCode}`);
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    if (duplicates.length > 0) {
      warnings.push({
        index: 0,
        type: 'warning',
        text: `You have ${duplicates.length} duplicate choices in your option list.`
      });
    }

    return {
      isValid: warnings.length === 0,
      warnings: warnings
    };
  }

  /**
   * Export Options formatted for Copy-Paste into Official DoTE Portal (tneaonline.org)
   */
  formatForDoTEPortal() {
    let text = "=======================================================\n";
    text += " OFFICIAL TNEA DOTE CHOICE FILLING OPTION LIST\n";
    text += " Generated via TNEA Admission Intelligence Platform\n";
    text += "=======================================================\n\n";
    text += "Pref No | College Code | Branch | College Name & District\n";
    text += "--------+--------------+--------+-------------------------------------------------\n";

    this.choices.forEach((c, idx) => {
      const prefStr = String(idx + 1).padStart(7, ' ');
      const codeStr = String(c.collegeCode).padStart(12, ' ');
      const branchStr = String(c.branchCode).padStart(6, ' ');
      text += `${prefStr} | ${codeStr} | ${branchStr} | ${c.collegeName} (${c.district})\n`;
    });

    text += "\n=======================================================\n";
    text += `Total Choices Configured: ${this.choices.length}\n`;
    text += "=======================================================\n";

    return text;
  }

  /**
   * Export Choices to CSV File
   */
  exportCSV() {
    let csv = "Preference_No,College_Code,College_Name,Branch_Code,Branch_Name,District,Historical_Cutoff,ML_Probability,Risk_Tier\n";
    this.choices.forEach((c, idx) => {
      csv += `${idx + 1},"${c.collegeCode}","${c.collegeName.replace(/"/g, '""')}","${c.branchCode}","${c.branchName}","${c.district}",${c.closingCutoff},${c.probability}%,${c.tierTag}\n`;
    });
    return csv;
  }
}

if (typeof window !== 'undefined') {
  window.ChoiceListOptimizer = new ChoiceListOptimizer();
}
