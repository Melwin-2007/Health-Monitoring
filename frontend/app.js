/**
 * AirQual — Apple Minimalist Client & Animated Data Flow
 * Smart Air Quality Monitoring and Health Risk Prediction System
 * Dept. of CSE, HSIT Nidasoshi (2025-26)
 */

let waveChart = null;
let currentValues = {
  temp: 27.9,
  hum: 62.0,
  co: 3.04,
  co2: 581.0,
  aqi: 118,
  risk: 14.2
};
let isDraggingSlider = false;

// Smooth Animated Number Counter
function animateValue(elementId, start, end, duration = 600, decimals = 1, suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  if (isNaN(start)) start = 0;
  if (isNaN(end)) end = 0;

  const range = end - start;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1.0);
    // Ease Out Quad
    const easeProgress = 1 - (1 - progress) * (1 - progress);
    const current = start + range * easeProgress;

    el.textContent = current.toFixed(decimals) + suffix;

    if (progress < 1.0) {
      requestAnimationFrame(update);
    } else {
      el.textContent = end.toFixed(decimals) + suffix;
    }
  }

  requestAnimationFrame(update);
}

// Navigation scroll helpers
function scrollToDemo() {
  const el = document.getElementById('demo');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToHardware() {
  const el = document.getElementById('hardware');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Minimalist Chart Initialization
function initMinimalChart() {
  const canvas = document.getElementById('minimalWaveChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Gradients for area fills
  const gradCo = ctx.createLinearGradient(0, 0, 0, 300);
  gradCo.addColorStop(0, 'rgba(255, 69, 58, 0.25)');
  gradCo.addColorStop(1, 'rgba(255, 69, 58, 0.0)');

  const gradCo2 = ctx.createLinearGradient(0, 0, 0, 300);
  gradCo2.addColorStop(0, 'rgba(48, 209, 88, 0.22)');
  gradCo2.addColorStop(1, 'rgba(48, 209, 88, 0.0)');

  waveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Sensed CO (ppm)',
          data: [],
          borderColor: '#ff453a',
          backgroundColor: gradCo,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y_co',
          fill: true
        },
        {
          label: 'Predicted CO₂ (ppm)',
          data: [],
          borderColor: '#30d158',
          backgroundColor: gradCo2,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y_co2',
          fill: true
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
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(16, 16, 20, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          titleColor: '#86868b',
          bodyColor: '#ffffff',
          titleFont: { family: 'Plus Jakarta Sans', size: 10 },
          bodyFont: { family: 'JetBrains Mono', size: 12, weight: '500' },
          padding: 12,
          cornerRadius: 12
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#52525b', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 6 }
        },
        y_co: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#ff453a', font: { family: 'JetBrains Mono', size: 10 } },
          suggestedMin: 0,
          suggestedMax: 15
        },
        y_co2: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#30d158', font: { family: 'JetBrains Mono', size: 10 } },
          suggestedMin: 400,
          suggestedMax: 1600
        }
      }
    }
  });
}

// Update the Bento Grid & Hero UI
function updateUI(t) {
  if (!t) return;

  // Animate hero numbers
  animateValue('hero-co', currentValues.co, t.co_ppm, 600, 2);
  animateValue('hero-co2', currentValues.co2, Math.round(t.predicted_co2_ppm), 600, 0);
  animateValue('hero-aqi', currentValues.aqi, t.aqi, 600, 0);
  animateValue('hero-temp', currentValues.temp, t.temperature, 600, 1);
  animateValue('hero-hum', currentValues.hum, Math.round(t.humidity), 600, 0);
  animateValue('hero-risk-score', currentValues.risk, t.health_risk_score, 600, 1);

  // Confidence Interval
  const ciEl = document.getElementById('hero-co2-ci');
  if (ciEl) {
    const low = Math.round(t.co2_lower_ci || t.predicted_co2_ppm * 0.95);
    const high = Math.round(t.co2_upper_ci || t.predicted_co2_ppm * 1.05);
    ciEl.textContent = `${low} - ${high} ppm`;
  }

  // AQI Pill & Bar
  const aqiPill = document.getElementById('hero-aqi-pill');
  const aqiBar = document.getElementById('hero-aqi-bar');
  if (aqiPill) {
    aqiPill.textContent = t.aqi_category || 'Moderate';
    aqiPill.style.color = t.aqi_color || '#ff9f0a';
    aqiPill.style.backgroundColor = `${t.aqi_color || '#ff9f0a'}20`;
    aqiPill.style.borderColor = `${t.aqi_color || '#ff9f0a'}40`;
  }
  if (aqiBar) {
    const pct = Math.min(100, Math.max(5, (t.aqi / 500) * 100));
    aqiBar.style.width = `${pct}%`;
    aqiBar.style.backgroundColor = t.aqi_color || '#ff9f0a';
  }

  // Risk Pill & Summary
  const riskPill = document.getElementById('hero-risk-pill');
  const riskSummary = document.getElementById('hero-health-summary');
  const maskEl = document.getElementById('hero-mask');
  if (riskPill) {
    riskPill.textContent = `${t.health_risk_level || 'Low'} Risk`;
    riskPill.style.color = t.health_risk_color || '#30d158';
    riskPill.style.backgroundColor = `${t.health_risk_color || '#30d158'}20`;
    riskPill.style.borderColor = `${t.health_risk_color || '#30d158'}40`;
  }
  if (riskSummary && t.health_risk_summary) {
    riskSummary.textContent = t.health_risk_summary;
  }
  if (maskEl && t.mask_recommendation) {
    maskEl.textContent = t.mask_recommendation;
  }

  // Clinical Section text
  const healthMask = document.getElementById('health-mask-text');
  if (healthMask && t.mask_recommendation) healthMask.textContent = t.mask_recommendation;
  const healthVent = document.getElementById('health-vent-text');
  if (healthVent && t.ventilation_advisory) healthVent.textContent = t.ventilation_advisory;

  const details = t.details || {};
  const vul = t.vulnerable_groups || details.vulnerable_groups;
  const healthVul = document.getElementById('health-vul-text');
  if (healthVul && vul && vul[0]) {
    healthVul.textContent = vul[0].replace('Asthma & COPD: ', '');
  }

  // Save current values for next smooth interpolation
  currentValues = {
    temp: t.temperature,
    hum: t.humidity,
    co: t.co_ppm,
    co2: t.predicted_co2_ppm,
    aqi: t.aqi,
    risk: t.health_risk_score
  };
}

// Preset application
async function applyPreset(presetKey) {
  try {
    const res = await fetch(`/api/demo/apply-preset/${presetKey}`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      const item = data.data;
      
      // Update sliders
      document.getElementById('slider-temp').value = item.temperature;
      document.getElementById('slider-hum').value = item.humidity;
      document.getElementById('slider-co').value = item.co_ppm;
      document.getElementById('slider-temp-disp').textContent = item.temperature.toFixed(1) + ' °C';
      document.getElementById('slider-hum-disp').textContent = item.humidity.toFixed(0) + ' %';
      document.getElementById('slider-co-disp').textContent = item.co_ppm.toFixed(1) + ' ppm';

      updateUI(item);
      refreshChartData();
      addTickerLog(`[Preset: ${presetKey.toUpperCase()}] Temp=${item.temperature}°C Hum=${item.humidity}% CO=${item.co_ppm}ppm ==> CO2=${item.predicted_co2_ppm}ppm`);
    }
  } catch (err) {
    console.error('Preset error:', err);
  }
}

// Slider Handler
let sliderDebounce = null;
function onSliderMove() {
  const temp = parseFloat(document.getElementById('slider-temp').value);
  const hum = parseFloat(document.getElementById('slider-hum').value);
  const co = parseFloat(document.getElementById('slider-co').value);

  document.getElementById('slider-temp-disp').textContent = temp.toFixed(1) + ' °C';
  document.getElementById('slider-hum-disp').textContent = hum.toFixed(0) + ' %';
  document.getElementById('slider-co-disp').textContent = co.toFixed(1) + ' ppm';

  clearTimeout(sliderDebounce);
  sliderDebounce = setTimeout(async () => {
    try {
      const res = await fetch('/api/demo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: temp, humidity: hum, co_ppm: co, scenario_name: 'Interactive Slider' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        updateUI(data.data);
        refreshChartData();
      }
    } catch (e) {
      console.error(e);
    }
  }, 100);
}

// Dynamic Auto-Stream
async function toggleAutoStream(enabled) {
  try {
    await fetch('/api/demo/stream-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  } catch (err) {
    console.error(err);
  }
}

// Quick Hardware Packet Pusher
async function pushQuickHardwarePacket() {
  try {
    const t = 28.0 + (Math.random() * 2 - 1);
    const h = 60.0 + (Math.random() * 6 - 3);
    const c = 3.5 + (Math.random() * 1.5 - 0.7);

    const res = await fetch('/api/iot/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: 'ESP32_PHYSICAL_01',
        temperature: parseFloat(t.toFixed(1)),
        humidity: parseFloat(h.toFixed(0)),
        co_ppm: parseFloat(c.toFixed(2))
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const item = data.data;
      updateUI(item);
      refreshChartData();
      addTickerLog(`[${new Date().toLocaleTimeString()}] ESP32: Temp=${item.temperature}°C Hum=${item.humidity}% CO=${item.co_ppm}ppm ==> CO2=${item.predicted_co2_ppm}ppm (AQI ${item.aqi})`);
    }
  } catch (err) {
    console.error('Error sending hardware packet:', err);
  }
}

function addTickerLog(msg) {
  const container = document.getElementById('ticker-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'text-white/90';
  div.textContent = msg;
  container.insertBefore(div, container.firstChild);
  if (container.children.length > 10) {
    container.removeChild(container.lastChild);
  }
  const timeEl = document.getElementById('ticker-time');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
}

// Chart Data Refresher
async function refreshChartData() {
  try {
    const res = await fetch('/api/telemetry/history?limit=25');
    const data = await res.json();
    if (data.status === 'success' && data.history) {
      const labels = [];
      const coList = [];
      const co2List = [];

      data.history.forEach(row => {
        const d = new Date(row.timestamp);
        labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        coList.push(row.co_ppm);
        co2List.push(row.predicted_co2_ppm);
      });

      if (waveChart) {
        waveChart.data.labels = labels;
        waveChart.data.datasets[0].data = coList;
        waveChart.data.datasets[1].data = co2List;
        waveChart.update('none');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// Polling
async function pollLatest() {
  try {
    const res = await fetch('/api/telemetry/latest');
    const data = await res.json();
    if (data.status === 'success') {
      updateUI(data.telemetry);

      const navMode = document.getElementById('nav-mode-badge');
      if (navMode && data.system_status) {
        navMode.textContent = data.system_status.hardware_connected ? 'Live Hardware Active' : 'Demo Mode';
        navMode.className = data.system_status.hardware_connected ? 'text-[#30d158] font-bold' : 'text-white/80 font-medium';
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  initMinimalChart();
  pollLatest();
  refreshChartData();

  setInterval(pollLatest, 1800);
  setInterval(refreshChartData, 2400);

  if (window.lucide) {
    lucide.createIcons();
  }
});
