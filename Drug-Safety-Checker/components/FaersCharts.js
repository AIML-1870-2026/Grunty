/**
 * FaersCharts component
 * Chart.js 4 wrappers for FAERS adverse event visualizations.
 * Chart.js is loaded with defer — we poll until it's available.
 */

async function waitForChartJs(attempts = 30, interval = 200) {
  for (let i = 0; i < attempts; i++) {
    if (typeof window.Chart !== 'undefined') return window.Chart;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error('Chart.js failed to load');
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12 },
    },
    tooltip: {
      backgroundColor: '#1a2744',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: '#2e3f6b',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    },
  },
};

/**
 * Render a horizontal bar chart of top adverse reactions.
 * @param {HTMLElement} container
 * @param {Array<{term:string, count:number}>} reactions
 */
export async function renderReactionsChart(container, reactions) {
  if (!reactions?.length) {
    container.innerHTML = '<p class="panel-unavailable">No reaction data available.</p>';
    return;
  }

  const Chart = await waitForChartJs();
  const top = reactions.slice(0, 10);

  const wrap = document.createElement('div');
  wrap.className = 'chart-container';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Top adverse reactions bar chart');
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  // Accessible table fallback
  const table = document.createElement('table');
  table.className = 'sr-only';
  table.innerHTML = `<caption>Top adverse reactions</caption>
    <thead><tr><th>Reaction</th><th>Reports</th></tr></thead>
    <tbody>${top.map(r => `<tr><td>${r.term}</td><td>${r.count}</td></tr>`).join('')}</tbody>`;
  container.appendChild(table);

  const maxCount = Math.max(...top.map(r => r.count));

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(r => r.term),
      datasets: [{
        label: 'Reports',
        data: top.map(r => r.count),
        backgroundColor: top.map((_, i) => {
          const alpha = 0.85 - (i / top.length) * 0.35;
          return `rgba(59, 130, 246, ${alpha})`;
        }),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,.05)' },
          border: { color: 'rgba(255,255,255,.08)' },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: v => v.length > 28 ? v.slice(0, 26) + '…' : v,
          },
          grid: { display: false },
        },
      },
    },
  });
}

/**
 * Render a donut chart of serious vs non-serious outcomes.
 * @param {HTMLElement} container
 * @param {number} seriousCount
 * @param {number} totalCount
 */
export async function renderOutcomesDonut(container, seriousCount, totalCount) {
  if (!totalCount) {
    container.innerHTML = '<p class="panel-unavailable">No outcome data available.</p>';
    return;
  }

  const Chart = await waitForChartJs();
  const nonSerious = Math.max(0, totalCount - seriousCount);

  const wrap = document.createElement('div');
  wrap.className = 'chart-container';
  wrap.style.maxWidth = '220px';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Serious vs non-serious outcomes donut chart');
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const table = document.createElement('table');
  table.className = 'sr-only';
  table.innerHTML = `<caption>Outcome breakdown</caption>
    <tbody><tr><td>Serious</td><td>${seriousCount}</td></tr>
    <tr><td>Non-serious</td><td>${nonSerious}</td></tr></tbody>`;
  container.appendChild(table);

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Serious', 'Non-serious'],
      datasets: [{
        data: [seriousCount, nonSerious],
        backgroundColor: ['rgba(239,68,68,.75)', 'rgba(59,130,246,.5)'],
        borderColor: ['rgba(239,68,68,1)', 'rgba(59,130,246,1)'],
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '62%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, padding: 12 },
        },
      },
    },
  });
}

/**
 * Render a horizontal bar chart for a single drug's top FAERS reactions.
 * @param {HTMLElement} container
 * @param {Array<{term:string, count:number}>} reactions
 * @param {string} drugName
 * @param {string} colorRgb  e.g. "96,165,250"
 */
export async function renderSingleDrugBar(container, reactions, drugName, colorRgb = '96,165,250') {
  if (!reactions?.length) {
    container.innerHTML = '<p class="panel-unavailable">No FAERS data available.</p>';
    return;
  }

  const Chart = await waitForChartJs();
  const top = reactions.slice(0, 10);

  const wrap = document.createElement('div');
  wrap.className = 'chart-container';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `Top adverse reactions for ${drugName}`);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const table = document.createElement('table');
  table.className = 'sr-only';
  table.innerHTML = `<caption>Top reactions for ${drugName}</caption>
    <thead><tr><th>Reaction</th><th>Reports</th></tr></thead>
    <tbody>${top.map(r => `<tr><td>${r.term}</td><td>${r.count}</td></tr>`).join('')}</tbody>`;
  container.appendChild(table);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map(r => r.term),
      datasets: [{
        label: 'Reports',
        data: top.map(r => r.count),
        backgroundColor: top.map((_, i) => `rgba(${colorRgb}, ${0.85 - (i / top.length) * 0.4})`),
        borderColor: `rgba(${colorRgb}, 1)`,
        borderWidth: 0,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.parsed.x.toLocaleString()} reports`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,.04)' },
          border: { color: 'rgba(255,255,255,.06)' },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: v => v.length > 26 ? v.slice(0, 24) + '…' : v,
          },
          grid: { display: false },
        },
      },
    },
  });
}

/**
 * Render a grouped horizontal bar comparing top reactions of two drugs.
 * @param {HTMLElement} container
 * @param {Array<{term:string, count:number}>} reactionsA
 * @param {Array<{term:string, count:number}>} reactionsB
 * @param {string} nameA
 * @param {string} nameB
 */
export async function renderComparisonBar(container, reactionsA, reactionsB, nameA, nameB) {
  if (!reactionsA?.length && !reactionsB?.length) {
    container.innerHTML = '<p class="panel-unavailable">No comparison data available.</p>';
    return;
  }

  const Chart = await waitForChartJs();

  // Build union of top reactions from both, sorted by combined count
  const mapA = Object.fromEntries((reactionsA || []).map(r => [r.term.toLowerCase(), r.count]));
  const mapB = Object.fromEntries((reactionsB || []).map(r => [r.term.toLowerCase(), r.count]));

  const allTerms = [...new Set([
    ...(reactionsA || []).slice(0, 8).map(r => r.term),
    ...(reactionsB || []).slice(0, 8).map(r => r.term),
  ])];

  // Sort by combined count descending, keep top 10
  const ranked = allTerms
    .map(term => ({
      term,
      a: mapA[term.toLowerCase()] || 0,
      b: mapB[term.toLowerCase()] || 0,
    }))
    .sort((x, y) => (y.a + y.b) - (x.a + x.b))
    .slice(0, 10);

  const wrap = document.createElement('div');
  wrap.className = 'chart-container chart-container-comparison';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `Adverse reactions comparison: ${nameA} vs ${nameB}`);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const table = document.createElement('table');
  table.className = 'sr-only';
  table.innerHTML = `<caption>Reaction comparison</caption>
    <thead><tr><th>Reaction</th><th>${nameA}</th><th>${nameB}</th></tr></thead>
    <tbody>${ranked.map(r => `<tr><td>${r.term}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join('')}</tbody>`;
  container.appendChild(table);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ranked.map(r => r.term),
      datasets: [
        {
          label: nameA,
          data: ranked.map(r => r.a),
          backgroundColor: 'rgba(96,165,250,.75)',
          borderColor: 'rgba(96,165,250,1)',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: nameB,
          data: ranked.map(r => r.b),
          backgroundColor: 'rgba(167,139,250,.75)',
          borderColor: 'rgba(167,139,250,1)',
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 14 },
        },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x.toLocaleString()} reports`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,.04)' },
          border: { color: 'rgba(255,255,255,.06)' },
          stacked: false,
        },
        y: {
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: v => v.length > 26 ? v.slice(0, 24) + '…' : v,
          },
          grid: { display: false },
          stacked: false,
        },
      },
    },
  });
}

/**
 * Render a line sparkline of reports over time.
 * @param {HTMLElement} container
 * @param {Array<{time:string, count:number}>} points
 */
export async function renderTimeSeriesChart(container, points) {
  if (!points?.length) {
    container.innerHTML = '<p class="panel-unavailable">No time series data available.</p>';
    return;
  }

  const Chart = await waitForChartJs();

  // Aggregate by year for readability
  const byYear = {};
  for (const p of points) {
    const year = String(p.time || p.date || '').slice(0, 4);
    if (year.length === 4) byYear[year] = (byYear[year] || 0) + (p.count || 0);
  }
  const years  = Object.keys(byYear).sort().slice(-8);
  const counts = years.map(y => byYear[y]);

  const wrap = document.createElement('div');
  wrap.className = 'chart-container';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Reports over time line chart');
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Reports',
        data: counts,
        borderColor: 'rgba(59,130,246,.9)',
        backgroundColor: 'rgba(59,130,246,.08)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59,130,246,1)',
        pointRadius: 4,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,.04)' },
          border: { color: 'rgba(255,255,255,.08)' },
        },
        y: {
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,.04)' },
          border: { color: 'rgba(255,255,255,.08)' },
        },
      },
    },
  });
}
