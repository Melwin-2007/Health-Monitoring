/**
 * Cinematic Engineering & Groq AI Client
 * Smart Air Quality Monitoring and Health Risk Prediction System
 * Dept. of CSE, HSIT Nidasoshi (2025-26)
 */

let oscChart = null;
let currentValues = {
  co: 0,
  co2: 0,
  temp: 0,
  hum: 0,
  aqi: 0,
  risk: 0
};
let latestTelemetry = null;

// Smooth Animated Number Counter
function animateVal(id, start, end, decimals = 1, dur = 500) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isNaN(start)) start = 0;
  if (isNaN(end)) end = 0;
  const range = end - start;
  const t0 = performance.now();

  function step(now) {
    const p = Math.min((now - t0) / dur, 1.0);
    const cur = start + range * (1 - Math.pow(1 - p, 2));
    el.textContent = cur.toFixed(decimals);
    if (p < 1.0) requestAnimationFrame(step);
    else el.textContent = end.toFixed(decimals);
  }
  requestAnimationFrame(step);
}

// Landing Boot-up Wake-up Sequence
function wakeUpHudCounters() {
  if (!latestTelemetry) return;
  animateVal('kpi-co', 0, latestTelemetry.co_ppm, 2, 800);
  animateVal('kpi-co2', 400, Math.round(latestTelemetry.predicted_co2_ppm), 0, 900);
  animateVal('kpi-aqi', 0, latestTelemetry.aqi, 0, 700);
  animateVal('kpi-temp', 0, latestTelemetry.temperature, 1, 600);
  animateVal('kpi-hum', 0, Math.round(latestTelemetry.humidity), 0, 600);

  // Trigger default AI diagnostic on first boot
  setTimeout(() => {
    triggerAIAnalysis('diagnostic');
  }, 1200);
}

// Groq Key Modal Management
function toggleGroqModal() {
  const modal = document.getElementById('groq-modal');
  modal.classList.toggle('hidden');
  modal.classList.toggle('flex');
}

function saveGroqKey() {
  const key = document.getElementById('groq-key-input').value.trim();
  if (key) {
    localStorage.setItem('AIRQUAL_GROQ_KEY', key);
    document.getElementById('groq-pill-label').textContent = 'GROQ ACTIVE';
  } else {
    localStorage.removeItem('AIRQUAL_GROQ_KEY');
    document.getElementById('groq-pill-label').textContent = 'GROQ AI';
  }
  toggleGroqModal();
}

// Groq AI Analysis Execution
async function triggerAIAnalysis(taskType) {
  const container = document.getElementById('ai-response-container');
  const badge = document.getElementById('ai-engine-badge');
  container.innerHTML = `
    <div class="text-[#00e5ff] flex items-center gap-2 py-4">
      <span class="animate-spin text-base">◌</span>
      <span>Generating ${taskType.toUpperCase()} analysis via Groq LLaMA-3.3-70B...</span>
    </div>
  `;

  const userKey = localStorage.getItem('AIRQUAL_GROQ_KEY') || null;

  try {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_type: taskType,
        api_key: userKey,
        temperature: latestTelemetry ? latestTelemetry.temperature : null,
        humidity: latestTelemetry ? latestTelemetry.humidity : null,
        co_ppm: latestTelemetry ? latestTelemetry.co_ppm : null
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      badge.textContent = data.provider.toUpperCase();
      badge.className = data.is_live_groq 
        ? 'px-2 py-0.5 text-[10px] font-mono font-bold bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30'
        : 'px-2 py-0.5 text-[10px] font-mono font-bold bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30';

      // Convert basic markdown formatting to HTML cleanly
      let md = data.analysis_markdown;
      md = md.replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-white border-b border-white/10 pb-1 mt-2 mb-1.5">$1</h4>');
      md = md.replace(/^#### (.*$)/gim, '<h5 class="text-xs font-bold text-[#00ff66] mt-2 mb-1">$1</h5>');
      md = md.replace(/\*\*(.*?)\*\*/gim, '<strong class="text-white">$1</strong>');
      md = md.replace(/\*(.*?)\*/gim, '<em class="text-[#a1a1aa]">$1</em>');
      md = md.replace(/`([^`]+)`/gim, '<code class="px-1 py-0.5 bg-white/10 text-[#00e5ff] text-[10px]">$1</code>');
      md = md.replace(/\n\n/gim, '<br><br>');
      md = md.replace(/\n- (.*$)/gim, '<div class="flex items-start gap-1.5 ml-2"><span class="text-[#00ff66]">•</span><span>$1</span></div>');

      container.innerHTML = md;
    } else {
      container.innerHTML = `<div class="text-[#ff3b30]">// AI Analysis Failed: ${data.detail || 'Unknown error'}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="text-[#ff3b30]">// Connection error reaching AI endpoint: ${err.message}</div>`;
  }
}

// Chart.js Oscilloscope Initialization
function initOscilloscope() {
  const canvas = document.getElementById('mainOscilloscopeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  oscChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Sensed CO (ppm)',
          data: [],
          borderColor: '#ff3b30',
          backgroundColor: 'rgba(255, 59, 48, 0.08)',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          yAxisID: 'y_co',
          fill: true
        },
        {
          label: 'Predicted CO₂ (ppm)',
          data: [],
          borderColor: '#00ff66',
          backgroundColor: 'rgba(0, 255, 102, 0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
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
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0f',
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          titleFont: { family: 'Chivo Mono', size: 10 },
          bodyFont: { family: 'Chivo Mono', size: 11 }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#71717a', font: { family: 'Chivo Mono', size: 10 } }
        },
        y_co: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#ff3b30', font: { family: 'Chivo Mono', size: 10 } },
          suggestedMin: 0,
          suggestedMax: 20
        },
        y_co2: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#00ff66', font: { family: 'Chivo Mono', size: 10 } },
          suggestedMin: 400,
          suggestedMax: 1800
        }
      }
    }
  });
}

// Update Cockpit Elements
function updateCockpit(t) {
  if (!t) return;
  latestTelemetry = t;

  animateVal('kpi-co', currentValues.co, t.co_ppm, 2);
  animateVal('kpi-co2', currentValues.co2, Math.round(t.predicted_co2_ppm), 0);
  animateVal('kpi-aqi', currentValues.aqi, t.aqi, 0);
  animateVal('kpi-temp', currentValues.temp, t.temperature, 1);
  animateVal('kpi-hum', currentValues.hum, Math.round(t.humidity), 0);

  // Carboxyhemoglobin HbCO
  const hbco = Math.min(35.0, Math.max(0.5, t.co_ppm * 0.18 + 0.4));
  const hbcoEl = document.getElementById('kpi-hbco');
  if (hbcoEl) hbcoEl.textContent = `${hbco.toFixed(1)}% HbCO`;

  // Confidence Interval
  const ciEl = document.getElementById('kpi-co2-ci');
  if (ciEl) {
    const low = Math.round(t.co2_lower_ci || t.predicted_co2_ppm * 0.95);
    const high = Math.round(t.co2_upper_ci || t.predicted_co2_ppm * 1.05);
    ciEl.textContent = `${low} - ${high} ppm`;
  }

  // AQI Pill & Bar
  const aqiPill = document.getElementById('kpi-aqi-pill');
  const aqiTrack = document.getElementById('kpi-aqi-track');
  if (aqiPill) {
    aqiPill.textContent = (t.aqi_category || 'MODERATE').toUpperCase();
    aqiPill.style.color = t.aqi_color || '#ffb000';
  }
  if (aqiTrack) {
    const pct = Math.min(100, Math.max(6, (t.aqi / 500) * 100));
    aqiTrack.style.width = `${pct}%`;
    aqiTrack.style.backgroundColor = t.aqi_color || '#ffb000';
  }

  // Mask & Ventilation Guidance
  const sumMask = document.getElementById('sum-mask');
  if (sumMask && t.mask_recommendation) sumMask.textContent = t.mask_recommendation;
  const sumVent = document.getElementById('sum-vent');
  if (sumVent && t.ventilation_advisory) sumVent.textContent = t.ventilation_advisory;

  // 3D Chamber update
  if (window.updateChamberParams) {
    window.updateChamberParams(t.co_ppm, t.predicted_co2_ppm, t.temperature, t.humidity);
  }

  const dynConvect = document.getElementById('dyn-convect');
  if (dynConvect) dynConvect.textContent = `${(0.8 + (t.temperature / 40.0) * 0.9).toFixed(2)} m/s`;
  const dynEr = document.getElementById('dyn-er');
  if (dynEr) dynEr.textContent = `${(t.co_co2_ratio_pct || 1.83)}%`;

  currentValues = {
    co: t.co_ppm,
    co2: t.predicted_co2_ppm,
    temp: t.temperature,
    hum: t.humidity,
    aqi: t.aqi,
    risk: t.health_risk_score
  };
}

// Preset Handlers
async function applyPreset(key) {
  try {
    const res = await fetch(`/api/demo/apply-preset/${key}`, { method: 'POST' });
    const d = await res.json();
    if (d.status === 'success') {
      const item = d.data;
      document.getElementById('slider-temp').value = item.temperature;
      document.getElementById('slider-hum').value = item.humidity;
      document.getElementById('slider-co').value = item.co_ppm;
      document.getElementById('slider-temp-disp').textContent = item.temperature.toFixed(1) + ' °C';
      document.getElementById('slider-hum-disp').textContent = item.humidity.toFixed(0) + ' %';
      document.getElementById('slider-co-disp').textContent = item.co_ppm.toFixed(2) + ' ppm';

      updateCockpit(item);
      refreshOscilloscope();
      logHardwareFeed(`[PRESET: ${key.toUpperCase()}] Injected Temp=${item.temperature}°C Hum=${item.humidity}% CO=${item.co_ppm}ppm ==> CO2=${item.predicted_co2_ppm}ppm`);
    }
  } catch (e) {
    console.error(e);
  }
}

// Sliders Handler
let sliderDebounce = null;
function onSliderMove() {
  const temp = parseFloat(document.getElementById('slider-temp').value);
  const hum = parseFloat(document.getElementById('slider-hum').value);
  const co = parseFloat(document.getElementById('slider-co').value);

  document.getElementById('slider-temp-disp').textContent = temp.toFixed(1) + ' °C';
  document.getElementById('slider-hum-disp').textContent = hum.toFixed(0) + ' %';
  document.getElementById('slider-co-disp').textContent = co.toFixed(2) + ' ppm';

  clearTimeout(sliderDebounce);
  sliderDebounce = setTimeout(async () => {
    try {
      const res = await fetch('/api/demo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: temp, humidity: hum, co_ppm: co, scenario_name: 'Interactive Manual' })
      });
      const d = await res.json();
      if (d.status === 'success') {
        updateCockpit(d.data);
        refreshOscilloscope();
      }
    } catch (e) {
      console.error(e);
    }
  }, 100);
}

// Auto Stream Loop
async function toggleAutoStream(enabled) {
  try {
    await fetch('/api/demo/stream-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  } catch (e) {
    console.error(e);
  }
}

// Transmit Hardware Test Packet
async function transmitHardwarePacket() {
  const t = parseFloat((28.0 + Math.random() * 2).toFixed(1));
  const h = parseFloat(Math.round(58 + Math.random() * 8));
  const c = parseFloat((3.0 + Math.random() * 1.5).toFixed(2));
  try {
    const res = await fetch('/api/iot/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: 'ESP32_PHYSICAL_01', temperature: t, humidity: h, co_ppm: c })
    });
    const d = await res.json();
    if (d.status === 'success') {
      const item = d.data;
      updateCockpit(item);
      refreshOscilloscope();
      logHardwareFeed(`[${new Date().toLocaleTimeString()}] RECV <= ESP32: Temp=${item.temperature}°C Hum=${item.humidity}% CO=${item.co_ppm}ppm ==> CO2=${item.predicted_co2_ppm}ppm (AQI ${item.aqi})`);
    }
  } catch (e) {
    console.error(e);
  }
}

function logHardwareFeed(msg) {
  const term = document.getElementById('hardware-feed-terminal');
  if (!term) return;
  const div = document.createElement('div');
  div.className = 'text-[#00ff66]';
  div.textContent = msg;
  term.insertBefore(div, term.firstChild);
  if (term.children.length > 8) {
    term.removeChild(term.lastChild);
  }
}

// Oscilloscope History Refresher
async function refreshOscilloscope() {
  try {
    const res = await fetch('/api/telemetry/history?limit=30');
    const data = await res.json();
    if (data.status === 'success' && data.history && oscChart) {
      const labels = [];
      const coList = [];
      const co2List = [];
      data.history.forEach(row => {
        const d = new Date(row.timestamp);
        labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        coList.push(row.co_ppm);
        co2List.push(row.predicted_co2_ppm);
      });
      oscChart.data.labels = labels;
      oscChart.data.datasets[0].data = coList;
      oscChart.data.datasets[1].data = co2List;
      oscChart.update('none');
    }
  } catch (e) {
    console.error(e);
  }
}

// Polling Latest Telemetry
async function pollLatest() {
  try {
    const res = await fetch('/api/telemetry/latest');
    const data = await res.json();
    if (data.status === 'success') {
      updateCockpit(data.telemetry);
    }
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initOscilloscope();
  pollLatest();
  refreshOscilloscope();

  setInterval(pollLatest, 1800);
  setInterval(refreshOscilloscope, 2500);

  if (localStorage.getItem('AIRQUAL_GROQ_KEY')) {
    const pill = document.getElementById('groq-pill-label');
    if (pill) pill.textContent = 'GROQ ACTIVE';
  }

  if (window.lucide) lucide.createIcons();
});

window.wakeUpHudCounters = wakeUpHudCounters;
