/**
 * AirQual — User-Friendly Interactive Dashboard & Groq AI Q&A Client
 */

let trendChart = null;
let currentTelemetry = null;

// Smooth number animator
function animateCounter(id, start, end, decimals = 1, dur = 400) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isNaN(start)) start = 0;
  if (isNaN(end)) end = 0;
  const diff = end - start;
  const t0 = performance.now();

  function step(now) {
    const p = Math.min((now - t0) / dur, 1.0);
    const cur = start + diff * (1 - Math.pow(1 - p, 2));
    el.textContent = cur.toFixed(decimals);
    if (p < 1.0) requestAnimationFrame(step);
    else el.textContent = end.toFixed(decimals);
  }
  requestAnimationFrame(step);
}

// Update the entire user-friendly UI
function renderDashboard(t) {
  if (!t) return;
  currentTelemetry = t;

  const level = t.level || 0;
  const co = t.co || 0.0;
  const co2 = Math.round(t.co2 || 400.0);
  const temp = t.temperature || 25.0;
  const hum = Math.round(t.humidity || 50.0);
  const pm = Math.round(t.pm || 0.0);

  // Big AQI Score & Colors
  const bigNum = document.getElementById('big-aqi-number');
  const bigStat = document.getElementById('big-aqi-status');
  const badge = document.getElementById('air-badge');
  const verdictTitle = document.getElementById('air-verdict-title');
  const verdictDesc = document.getElementById('air-verdict-desc');

  let colorClass = '#10b981'; // Emerald/Green
  let statusText = 'Good Air Quality';
  let badgeText = 'Good Air Quality';
  let titleText = 'The air is clean and safe to breathe.';
  let descText = 'Pollution levels are low. Windows can be opened for fresh air ventilation, and outdoor exercise is safe for everyone including children and seniors.';

  if (level === 3) {
    colorClass = '#ef4444'; // Red
    statusText = 'Hazardous Air';
    badgeText = 'Severe Danger';
    titleText = 'Warning: Severe pollution detected!';
    descText = 'Smoke and pollutant levels are hazardous. Close all windows, stay indoors, and run an air purifier immediately.';
  } else if (level === 2) {
    colorClass = '#f97316'; // Orange
    statusText = 'Poor Air Quality';
    badgeText = 'Poor Air Quality';
    titleText = 'Unhealthy air conditions.';
    descText = 'Smoke is elevated. Sensitive people, children, and asthma patients should avoid outdoor exertion. Wear an N95 mask outside.';
  } else if (level === 1) {
    colorClass = '#f59e0b'; // Amber/Yellow
    statusText = 'Moderate Level';
    badgeText = 'Moderate Air Quality';
    titleText = 'Acceptable air, but mild caution for sensitive groups.';
    descText = 'Air quality is acceptable for most people. Anyone experiencing throat irritation should reduce heavy outdoor workouts.';
  }

  if (bigNum) {
    bigNum.textContent = level;
    bigNum.style.color = colorClass;
  }
  if (bigStat) {
    bigStat.textContent = statusText;
    bigStat.style.color = colorClass;
  }
  if (badge) {
    badge.textContent = badgeText;
    badge.style.color = colorClass;
    badge.style.borderColor = `${colorClass}40`;
    badge.style.backgroundColor = `${colorClass}15`;
  }
  if (verdictTitle) verdictTitle.textContent = titleText;
  if (verdictDesc) verdictDesc.textContent = descText;

  // Metrics
  const cardCo = document.getElementById('card-co');
  if (cardCo) cardCo.textContent = co.toFixed(1);

  const cardCo2 = document.getElementById('card-co2');
  if (cardCo2) cardCo2.textContent = co2;

  const cardPm = document.getElementById('card-pm');
  if (cardPm) cardPm.textContent = pm;

  const cardTemp = document.getElementById('card-temp');
  if (cardTemp) cardTemp.textContent = temp.toFixed(1);

  const cardHum = document.getElementById('card-hum');
  if (cardHum) cardHum.textContent = hum;

  // Action Advice Cards
  const actMask = document.getElementById('action-mask');
  if (actMask) {
      if (level === 0) actMask.textContent = 'No mask needed';
      else actMask.textContent = 'Consider N95 outdoors';
  }

  const actVent = document.getElementById('action-vent');
  if (actVent) {
      if (level <= 1) actVent.textContent = 'Open windows for breeze';
      else actVent.textContent = 'Keep windows closed';
  }

  const actHealth = document.getElementById('action-health');
  if (actHealth) {
    if (level === 0) actHealth.textContent = 'Safe for all activities';
    else if (level === 1) actHealth.textContent = 'Mild caution for asthma patients';
    else actHealth.textContent = 'Keep asthma patients & children indoors';
  }

  // Update slider label if slider is visible
  const sliderLabel = document.getElementById('slider-co-label');
  if (sliderLabel) {
    sliderLabel.textContent = `${co.toFixed(1)} ppm (${statusText})`;
    sliderLabel.style.color = colorClass;
  }
}

// Chart.js initialization
function initChart() {
  const canvas = document.getElementById('simpleTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'CO (ppm)',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
          yAxisID: 'y_co',
          fill: true
        },
        {
          label: 'CO₂ (ppm)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.35,
          yAxisID: 'y_co2',
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#71717a', font: { size: 10 } }
        },
        y_co: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'CO (ppm)', color: '#ef4444', font: { size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#ef4444', font: { size: 10 } },
          suggestedMin: 0,
          suggestedMax: 15
        },
        y_co2: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'CO₂ (ppm)', color: '#10b981', font: { size: 11 } },
          grid: { display: false },
          ticks: { color: '#10b981', font: { size: 10 } },
          suggestedMin: 400,
          suggestedMax: 1600
        }
      }
    }
  });
}

// Refresh Chart Data
async function refreshChart() {
  try {
    const res = await fetch('/api/telemetry/history?limit=25');
    const data = await res.json();
    if (data.status === 'success' && data.history && trendChart) {
      const labels = [];
      const coList = [];
      const co2List = [];
      data.history.forEach(row => {
        const d = new Date(row.timestamp);
        labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        coList.push(row.co);
        co2List.push(row.co2);
      });
      trendChart.data.labels = labels;
      trendChart.data.datasets[0].data = coList;
      trendChart.data.datasets[1].data = co2List;
      trendChart.update('none');
    }
  } catch (e) {
    console.error(e);
  }
}



// Groq AI Q&A Assistant Functions
async function askQuestion(questionText) {
  const box = document.getElementById('ai-answer-box');
  const btn = document.getElementById('ask-btn');
  if (!questionText.trim()) return;

  box.innerHTML = `
    <div class="flex items-center gap-2 text-emerald-400 py-2">
      <span class="animate-spin text-base">◌</span>
      <span>Thinking and consulting AirQual AI...</span>
    </div>
  `;
  if (btn) btn.disabled = true;

  const key = localStorage.getItem('AIRQUAL_GROQ_KEY') || null;

  try {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questionText,
        api_key: key,
        temperature: currentTelemetry ? currentTelemetry.temperature : null,
        humidity: currentTelemetry ? currentTelemetry.humidity : null,
        co: currentTelemetry ? currentTelemetry.co : null
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      box.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between border-b border-white/10 pb-1.5 text-[11px]">
            <span class="font-bold text-white">Q: "${data.question}"</span>
            <span class="text-emerald-400 font-semibold">${data.provider}</span>
          </div>
          <div class="text-neutral-200 text-xs leading-relaxed pt-1">
            ${data.answer.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    } else {
      box.innerHTML = `<div class="text-rose-400">Error generating answer: ${data.detail || 'Please try again.'}</div>`;
    }
  } catch (err) {
    box.innerHTML = `<div class="text-rose-400">Connection failed: ${err.message}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function askPresetQuestion(q) {
  document.getElementById('user-question-input').value = q;
  askQuestion(q);
}

function handleCustomQuestion(e) {
  e.preventDefault();
  const input = document.getElementById('user-question-input');
  askQuestion(input.value);
}

// Groq Modal functions
function toggleGroqModal() {
  const m = document.getElementById('groq-modal');
  m.classList.toggle('hidden');
  m.classList.toggle('flex');
}

function saveGroqKey() {
  const k = document.getElementById('groq-key-input').value.trim();
  if (k) {
    localStorage.setItem('AIRQUAL_GROQ_KEY', k);
    document.getElementById('groq-status-label').textContent = 'Groq Active';
  } else {
    localStorage.removeItem('AIRQUAL_GROQ_KEY');
    document.getElementById('groq-status-label').textContent = 'Groq AI';
  }
  toggleGroqModal();
}

// Master Polling Loop
async function pollStatus() {
  try {
    const res = await fetch('/api/telemetry/latest');
    const data = await res.json();
    if (data.status === 'success') {
      renderDashboard(data.telemetry);
    }
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initChart();
  pollStatus();
  refreshChart();

  setInterval(pollStatus, 1600);
  setInterval(refreshChart, 2500);

  if (localStorage.getItem('AIRQUAL_GROQ_KEY')) {
    const label = document.getElementById('groq-status-label');
    if (label) label.textContent = 'Groq Active';
  }

  if (window.lucide) lucide.createIcons();
});
