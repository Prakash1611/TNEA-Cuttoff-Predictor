/**
 * TNEA College Predictor System - SPA Application Controller
 * Handles Form State, Filtering, Rendering, Modals, Choice Builder Workflows, and PWA Integration.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize App State
  const state = {
    math: 98,
    physics: 94,
    chemistry: 92,
    cutoff: 191.00,
    community: 'OC',
    isGovtSchoolQuota: false,
    specialQuota: 'NONE',
    district: 'ALL',
    branch: 'ALL',
    riskFilter: 'ALL',
    tierFilter: 'ALL',
    activeTab: 'predictor',
    predictions: [],
    ranks: null
  };

  // DOM Cache
  const mathInput = document.getElementById('mathMarks');
  const physicsInput = document.getElementById('physicsMarks');
  const chemistryInput = document.getElementById('chemistryMarks');
  const cutoffDisplay = document.getElementById('cutoffDisplay');
  const communitySelect = document.getElementById('communitySelect');
  const govtQuotaToggle = document.getElementById('govtQuotaToggle');
  const specialQuotaSelect = document.getElementById('specialQuotaSelect');
  const districtSelect = document.getElementById('districtSelect');
  const branchSelect = document.getElementById('branchSelect');
  const riskFilterSelect = document.getElementById('riskFilterSelect');
  const tierFilterSelect = document.getElementById('tierFilterSelect');

  const overallRankVal = document.getElementById('overallRankVal');
  const communityRankVal = document.getElementById('communityRankVal');
  const commRankLabel = document.getElementById('commRankLabel');

  const resultsBody = document.getElementById('resultsBody');
  const resultsCount = document.getElementById('resultsCount');

  const navBtns = document.querySelectorAll('.nav-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  const trendModal = document.getElementById('trendModal');
  const swapModal = document.getElementById('swapModal');
  const exportModal = document.getElementById('exportModal');

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service Worker registered with scope:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  }

  // Handle PWA Install Prompt
  let deferredPrompt;
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'flex';
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showToast('TNEA Predictor App installed on your device!');
          }
          deferredPrompt = null;
          pwaInstallBtn.style.display = 'none';
        });
      }
    });
  }

  // Populate Dropdown Filters
  populateFilters();

  // Initial Calculation
  recalculateCutoffAndRanks();
  runPredictionQuery();

  // Event Listeners for Marks & Inputs
  [mathInput, physicsInput, chemistryInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        recalculateCutoffAndRanks();
        runPredictionQuery();
      });
    }
  });

  if (communitySelect) {
    communitySelect.addEventListener('change', (e) => {
      state.community = e.target.value;
      recalculateCutoffAndRanks();
      runPredictionQuery();
    });
  }

  if (govtQuotaToggle) {
    govtQuotaToggle.addEventListener('change', (e) => {
      state.isGovtSchoolQuota = e.target.checked;
      runPredictionQuery();
    });
  }

  if (specialQuotaSelect) {
    specialQuotaSelect.addEventListener('change', (e) => {
      state.specialQuota = e.target.value;
      runPredictionQuery();
    });
  }

  if (districtSelect) {
    districtSelect.addEventListener('change', (e) => {
      state.district = e.target.value;
      runPredictionQuery();
    });
  }

  if (branchSelect) {
    branchSelect.addEventListener('change', (e) => {
      state.branch = e.target.value;
      runPredictionQuery();
    });
  }

  if (riskFilterSelect) {
    riskFilterSelect.addEventListener('change', (e) => {
      state.riskFilter = e.target.value;
      runPredictionQuery();
    });
  }

  if (tierFilterSelect) {
    tierFilterSelect.addEventListener('change', (e) => {
      state.tierFilter = e.target.value;
      runPredictionQuery();
    });
  }

  // Navigation Tab Switches
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      state.activeTab = tabTarget;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabViews.forEach(view => {
        if (view.id === `${tabTarget}View`) {
          view.style.display = 'block';
        } else {
          view.style.display = 'none';
        }
      });

      if (tabTarget === 'choices') {
        renderChoiceListWorkspace();
      }
    });
  });

  /**
   * Recalculate Cutoff & State Ranks
   */
  function recalculateCutoffAndRanks() {
    state.math = parseFloat(mathInput?.value) || 0;
    state.physics = parseFloat(physicsInput?.value) || 0;
    state.chemistry = parseFloat(chemistryInput?.value) || 0;

    state.cutoff = window.MLEngine.calculateCutoff(state.math, state.physics, state.chemistry);
    if (cutoffDisplay) cutoffDisplay.textContent = state.cutoff.toFixed(2);

    state.ranks = window.MLEngine.predictRanks(state.cutoff, state.community);

    if (overallRankVal) overallRankVal.textContent = `~${state.ranks.overallRank.toLocaleString()}`;
    if (communityRankVal) communityRankVal.textContent = `~${state.ranks.communityRank.toLocaleString()}`;
    if (commRankLabel) commRankLabel.textContent = `${state.community} Rank`;
  }

  /**
   * Execute Prediction Query
   */
  function runPredictionQuery() {
    const districts = state.district === 'ALL' ? [] : [state.district];
    const branches = state.branch === 'ALL' ? [] : [state.branch];

    state.predictions = window.MLEngine.queryPredictions({
      userCutoff: state.cutoff,
      community: state.community,
      isGovtSchoolQuota: state.isGovtSchoolQuota,
      specialQuota: state.specialQuota,
      districts: districts,
      branches: branches,
      tierFilter: state.tierFilter,
      riskFilter: state.riskFilter
    });

    renderResultsTable(state.predictions);
  }

  /**
   * Render Prediction Results Table
   */
  function renderResultsTable(matches) {
    if (!resultsBody) return;
    resultsBody.innerHTML = '';

    if (resultsCount) {
      resultsCount.innerHTML = `Found <strong>${matches.length}</strong> matching college choices for cutoff <strong>${state.cutoff.toFixed(2)}</strong> (${state.community} Quota)`;
    }

    if (matches.length === 0) {
      resultsBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
            No college matches found for the selected filter criteria. Try adjusting district or branch preferences.
          </td>
        </tr>
      `;
      return;
    }

    matches.forEach(item => {
      const tr = document.createElement('tr');
      const ml = item.mlPrediction;

      tr.innerHTML = `
        <td>
          <div class="college-name-cell">
            <span>${item.college.name}</span>
            <div class="college-meta">
              <span>Code: <strong>${item.college.code}</strong></span> &bull;
              <span><i class="fas fa-map-marker-alt"></i> ${item.college.district}</span> &bull;
              <span>${item.college.tier}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="branch-badge" title="${item.branch.name}">${item.branch.short}</span>
        </td>
        <td>
          <div class="cutoff-num">${item.closingCutoff.toFixed(2)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Rank: ~${item.closingRank.toLocaleString()}</div>
        </td>
        <td>
          <span class="risk-pill ${ml.badgeClass}">
            <i class="fas ${ml.tier === 'Safe' ? 'fa-shield-alt' : ml.tier === 'Target' ? 'fa-bullseye' : 'fa-exclamation-triangle'}"></i>
            ${ml.tier} (${ml.probability}%)
          </span>
        </td>
        <td>
          <div style="font-size: 0.8rem; font-weight: 600; color: ${item.trend5Yr > 0 ? '#f43f5e' : '#10b981'};">
            ${item.trend5Yr > 0 ? '▲ +' : '▼ '}${item.trend5Yr.toFixed(2)} pts
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">5-Yr Shift</div>
        </td>
        <td>
          <div class="action-cell-btns">
            <button class="btn-secondary btn-sm add-choice-btn" data-college="${item.college.code}" data-branch="${item.branch.code}">
              <i class="fas fa-plus"></i> Add Choice
            </button>
            <button class="btn-secondary btn-sm trend-btn" data-college="${item.college.code}" data-branch="${item.branch.code}">
              <i class="fas fa-chart-line"></i> Trend
            </button>
            ${ml.tier === 'Reach' ? `
              <button class="btn-secondary btn-sm swap-btn" data-college="${item.college.code}" data-branch="${item.branch.code}" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
                <i class="fas fa-random"></i> Swaps
              </button>
            ` : ''}
          </div>
        </td>
      `;

      resultsBody.appendChild(tr);
    });

    // Attach Event Listeners to Buttons
    document.querySelectorAll('.add-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cCode = btn.getAttribute('data-college');
        const bCode = btn.getAttribute('data-branch');
        const match = state.predictions.find(p => p.college.code === cCode && p.branch.code === bCode);

        if (match && window.ChoiceListOptimizer) {
          const res = window.ChoiceListOptimizer.addChoice({
            collegeCode: match.college.code,
            collegeName: match.college.name,
            district: match.college.district,
            branchCode: match.branch.code,
            branchName: match.branch.name,
            closingCutoff: match.closingCutoff,
            closingRank: match.closingRank,
            probability: match.mlPrediction.probability,
            tierTag: match.mlPrediction.tier
          });

          if (res.success) {
            showToast(`Added ${match.college.shortName} (${match.branch.short}) to your choice list!`);
          } else {
            showToast(res.message, 'warning');
          }
        }
      });
    });

    document.querySelectorAll('.trend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cCode = btn.getAttribute('data-college');
        const bCode = btn.getAttribute('data-branch');
        openTrendModal(cCode, bCode);
      });
    });

    document.querySelectorAll('.swap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cCode = btn.getAttribute('data-college');
        const bCode = btn.getAttribute('data-branch');
        openSwapModal(cCode, bCode);
      });
    });
  }

  /**
   * Render Choice List Builder Workspace
   */
  function renderChoiceListWorkspace() {
    const choiceContainer = document.getElementById('choiceListContainer');
    const warningContainer = document.getElementById('choiceWarningsContainer');

    if (!choiceContainer || !window.ChoiceListOptimizer) return;

    const choices = window.ChoiceListOptimizer.getChoices();
    const validation = window.ChoiceListOptimizer.validateStrategy();

    // Render Strategy Warnings
    if (warningContainer) {
      warningContainer.innerHTML = '';
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w => {
          const div = document.createElement('div');
          div.className = 'warning-banner';
          div.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <div>${w.text || w}</div>`;
          warningContainer.appendChild(div);
        });
      }
    }

    // Render Choice List
    choiceContainer.innerHTML = '';

    if (choices.length === 0) {
      choiceContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); background: rgba(9, 13, 22, 0.4); border-radius: var(--radius-md);">
          <i class="fas fa-clipboard-list" style="font-size: 2.5rem; margin-bottom: 0.75rem; display: block; color: var(--primary);"></i>
          <h3>Your DoTE Choice List is Empty</h3>
          <p style="font-size: 0.9rem; margin-top: 0.5rem; margin-bottom: 1.25rem;">Add options from the Predictor results tab or click the Auto Strategy Builder below.</p>
          <button id="autoBuildBtn" class="btn-primary" style="display: inline-flex; width: auto;">
            <i class="fas fa-magic"></i> Auto-Generate Strategy List (5 Reach + 10 Target + 10 Safe)
          </button>
        </div>
      `;

      const autoBtn = document.getElementById('autoBuildBtn');
      if (autoBtn) {
        autoBtn.addEventListener('click', () => {
          window.ChoiceListOptimizer.generateStrategyList(state.predictions);
          renderChoiceListWorkspace();
          showToast('Generated 25 balanced DoTE choices!');
        });
      }
      return;
    }

    choices.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'choice-item-card';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="choice-pref-badge">#${idx + 1}</div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${c.collegeName}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
              Code: <strong>${c.collegeCode}</strong> &bull; District: ${c.district} &bull; Cutoff: <strong>${c.closingCutoff.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="branch-badge">${c.branchCode}</span>
          <span class="risk-pill ${c.tierTag === 'Safe' ? 'risk-safe' : c.tierTag === 'Target' ? 'risk-target' : 'risk-reach'}">
            ${c.tierTag} (${c.probability}%)
          </span>
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn-secondary btn-sm move-up-btn" data-idx="${idx}"><i class="fas fa-arrow-up"></i></button>
            <button class="btn-secondary btn-sm move-down-btn" data-idx="${idx}"><i class="fas fa-arrow-down"></i></button>
            <button class="btn-secondary btn-sm remove-choice-btn" data-id="${c.id}" style="color: #f43f5e;"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;

      choiceContainer.appendChild(card);
    });

    // Attach Choice Action Handlers
    document.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        window.ChoiceListOptimizer.moveChoice(idx, 'up');
        renderChoiceListWorkspace();
      });
    });

    document.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        window.ChoiceListOptimizer.moveChoice(idx, 'down');
        renderChoiceListWorkspace();
      });
    });

    document.querySelectorAll('.remove-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        window.ChoiceListOptimizer.removeChoice(id);
        renderChoiceListWorkspace();
        showToast('Choice removed');
      });
    });
  }

  // Handle Export Options Event Listeners
  const exportFormatBtn = document.getElementById('exportFormatBtn');
  const copyDoTEBtn = document.getElementById('copyDoTEBtn');
  const downloadCSVBtn = document.getElementById('downloadCSVBtn');
  const clearChoicesBtn = document.getElementById('clearChoicesBtn');

  if (exportFormatBtn) {
    exportFormatBtn.addEventListener('click', () => {
      const text = window.ChoiceListOptimizer.formatForDoTEPortal();
      const exportTextarea = document.getElementById('exportTextarea');
      if (exportTextarea) exportTextarea.value = text;
      openExportModal();
    });
  }

  if (copyDoTEBtn) {
    copyDoTEBtn.addEventListener('click', () => {
      const text = window.ChoiceListOptimizer.formatForDoTEPortal();
      navigator.clipboard.writeText(text).then(() => {
        showToast('Official DoTE choice list copied to clipboard!');
      });
    });
  }

  if (downloadCSVBtn) {
    downloadCSVBtn.addEventListener('click', () => {
      const csv = window.ChoiceListOptimizer.exportCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `TNEA_Choice_List_${state.cutoff.toFixed(2)}.csv`);
      link.click();
      showToast('Downloaded CSV choice list!');
    });
  }

  if (clearChoicesBtn) {
    clearChoicesBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your entire choice list?')) {
        window.ChoiceListOptimizer.clearChoices();
        renderChoiceListWorkspace();
        showToast('Choice list cleared.');
      }
    });
  }

  /**
   * Modal Controllers
   */
  function openTrendModal(collegeCode, branchCode) {
    if (!trendModal || !window.TrendChartEngine) return;
    trendModal.classList.add('active');

    const stats = window.TrendChartEngine.renderTrendChart('trendChartCanvas', collegeCode, branchCode, state.community, state.isGovtSchoolQuota);

    if (stats) {
      document.getElementById('modalCollegeTitle').textContent = `${stats.collegeName} (${stats.branchCode})`;
      document.getElementById('modalAvgCutoff').textContent = stats.avgCutoff;
      document.getElementById('modalMaxCutoff').textContent = stats.maxCutoff;
      document.getElementById('modalShift5Yr').textContent = stats.delta5Yr;
      
      const trajEl = document.getElementById('modalTrajectory');
      if (trajEl) {
        trajEl.textContent = stats.trajectory;
      }
    }
  }

  function openSwapModal(collegeCode, primaryBranchCode) {
    if (!swapModal || !window.SmartBranchSwapEngine) return;
    swapModal.classList.add('active');

    const swapContainer = document.getElementById('swapResultsContainer');
    const swapTitle = document.getElementById('swapModalTitle');

    const recommendations = window.SmartBranchSwapEngine.getRecommendations(
      collegeCode,
      primaryBranchCode,
      state.cutoff,
      state.community,
      state.isGovtSchoolQuota
    );

    const dataset = window.TNEA_DATA;
    const college = dataset.colleges.find(c => c.code === collegeCode);
    const primBranch = dataset.branches.find(b => b.code === primaryBranchCode);

    if (swapTitle && college && primBranch) {
      swapTitle.textContent = `Smart Branch Swaps for ${college.shortName} (Primary: ${primBranch.short})`;
    }

    if (swapContainer) {
      swapContainer.innerHTML = '';
      if (recommendations.length === 0) {
        swapContainer.innerHTML = `<p style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No alternative branch recommendations available for this campus.</p>`;
        return;
      }

      recommendations.forEach(rec => {
        const item = document.createElement('div');
        item.style.cssText = `
          background: rgba(18, 26, 43, 0.7);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 1rem;
          margin-bottom: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;

        item.innerHTML = `
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">
              ${rec.branch.name} (<span class="branch-badge">${rec.branch.short}</span>)
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">
              Domain Affinity: <strong>${rec.affinityScore}% Match</strong> &bull; Cutoff: <strong>${rec.closingCutoff.toFixed(2)}</strong>
            </div>
            <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 0.25rem;">
              <i class="fas fa-info-circle"></i> ${rec.recommendationReason}
            </div>
          </div>
          <div style="text-align: right;">
            <span class="risk-pill ${rec.mlPrediction.badgeClass}">
              ${rec.mlPrediction.tier} (${rec.mlPrediction.probability}%)
            </span>
            <button class="btn-primary btn-sm add-swap-choice" data-college="${rec.college.code}" data-branch="${rec.branch.code}" style="margin-top: 0.5rem; width: 100%;">
              <i class="fas fa-plus"></i> Select Swap
            </button>
          </div>
        `;

        swapContainer.appendChild(item);
      });

      document.querySelectorAll('.add-swap-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          const cCode = btn.getAttribute('data-college');
          const bCode = btn.getAttribute('data-branch');
          const rec = recommendations.find(r => r.college.code === cCode && r.branch.code === bCode);

          if (rec && window.ChoiceListOptimizer) {
            window.ChoiceListOptimizer.addChoice({
              collegeCode: rec.college.code,
              collegeName: rec.college.name,
              district: rec.college.district,
              branchCode: rec.branch.code,
              branchName: rec.branch.name,
              closingCutoff: rec.closingCutoff,
              closingRank: rec.closingRank,
              probability: rec.mlPrediction.probability,
              tierTag: rec.mlPrediction.tier
            });
            showToast(`Added ${rec.branch.short} swap choice to your list!`);
            swapModal.classList.remove('active');
          }
        });
      });
    }
  }

  function openExportModal() {
    if (exportModal) exportModal.classList.add('active');
  }

  // Close Modals
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el || el.classList.contains('modal-close')) {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      }
    });
  });

  /**
   * Helper Dropdown Populator
   */
  function populateFilters() {
    if (!window.TNEA_DATA) return;
    const dataset = window.TNEA_DATA;

    if (districtSelect) {
      districtSelect.innerHTML = '<option value="ALL">All Districts across Tamil Nadu</option>';
      dataset.districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        districtSelect.appendChild(opt);
      });
    }

    if (branchSelect) {
      branchSelect.innerHTML = '<option value="ALL">All Engineering Branches & Streams</option>';
      dataset.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.code;
        opt.textContent = `${b.name} (${b.short})`;
        branchSelect.appendChild(opt);
      });
    }
  }

  /**
   * Toast Notifications Utility
   */
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <i class="fas ${type === 'warning' ? 'fa-exclamation-circle' : 'fa-check-circle'}" style="color: ${type === 'warning' ? '#f59e0b' : '#10b981'}; font-size: 1.1rem;"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
