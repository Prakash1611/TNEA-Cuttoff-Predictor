/**
 * Interactive 5-Year Cutoff & Rank Trend Visualization Engine
 * Renders dynamic Chart.js SVG/Canvas graphs with 2021-2025 cutoff and rank trends.
 */

class TrendChartEngine {
  constructor() {
    this.chartInstance = null;
  }

  /**
   * Render 5-Year Cutoff Trend Modal Chart
   */
  renderTrendChart(canvasId, collegeCode, branchCode, community = "OC", isGovtSchoolQuota = false) {
    if (!window.TNEA_DATA || typeof Chart === 'undefined') return;

    const dataset = window.TNEA_DATA;
    const college = dataset.colleges.find(c => c.code === collegeCode);
    const branch = dataset.branches.find(b => b.code === branchCode);

    if (!college || !branch) return;

    // Filter historical data points for 2021 to 2025
    const years = [2021, 2022, 2023, 2024, 2025];
    const cutoffs = [];
    const ranks = [];

    years.forEach(yr => {
      const entry = dataset.cutoffs.find(item =>
        item.collegeCode === collegeCode &&
        item.branchCode === branchCode &&
        item.year === yr &&
        item.community === community &&
        item.isGovtSchoolQuota === Boolean(isGovtSchoolQuota)
      );

      if (entry) {
        cutoffs.push(entry.closingCutoff);
        ranks.push(entry.closingRank);
      } else {
        cutoffs.push(null);
        ranks.push(null);
      }
    });

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy old chart instance if existing
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Gradient fill for background
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years.map(y => `${y} Counseling`),
        datasets: [
          {
            label: `Closing Cutoff Score (${community})`,
            data: cutoffs,
            borderColor: '#6366f1',
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#818cf8',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 13, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                const yrIdx = context.dataIndex;
                const score = context.parsed.y;
                const rk = ranks[yrIdx] ? ranks[yrIdx].toLocaleString() : 'N/A';
                return [
                  `Closing Cutoff: ${score.toFixed(2)} / 200.00`,
                  `Closing State Rank: ~${rk}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '500' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            ticks: { color: '#818cf8', font: { family: 'Plus Jakarta Sans', weight: '600' } },
            suggestedMin: Math.max(75, Math.floor(Math.min(...cutoffs.filter(n => n !== null)) - 3)),
            suggestedMax: Math.min(200, Math.ceil(Math.max(...cutoffs.filter(n => n !== null)) + 2))
          }
        }
      }
    });

    // Calculate Summary Stats
    const validCutoffs = cutoffs.filter(c => c !== null);
    const avgCutoff = validCutoffs.reduce((a, b) => a + b, 0) / validCutoffs.length;
    const maxCutoff = Math.max(...validCutoffs);
    const minCutoff = Math.min(...validCutoffs);
    const delta5Yr = cutoffs[4] - cutoffs[0];

    let trajectory = 'Stable Demand';
    let trajectoryClass = 'badge-stable';
    if (delta5Yr > 1.5) {
      trajectory = 'Rapidly Surging Demand 📈';
      trajectoryClass = 'badge-surging';
    } else if (delta5Yr < -1.5) {
      trajectory = 'Declining Demand 📉';
      trajectoryClass = 'badge-declining';
    }

    return {
      collegeName: college.name,
      branchName: branch.name,
      branchCode: branch.code,
      district: college.district,
      avgCutoff: avgCutoff.toFixed(2),
      maxCutoff: maxCutoff.toFixed(2),
      minCutoff: minCutoff.toFixed(2),
      delta5Yr: (delta5Yr >= 0 ? '+' : '') + delta5Yr.toFixed(2),
      trajectory: trajectory,
      trajectoryClass: trajectoryClass
    };
  }
}

if (typeof window !== 'undefined') {
  window.TrendChartEngine = new TrendChartEngine();
}
