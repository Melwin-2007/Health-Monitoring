/**
 * HBO Cinematic Intro & Landing Animator for AirQual
 * Analog static canvas generator, Web Audio synthesized harmonic chord,
 * and cinematic landing boot-up sequence.
 */

let hboAudioCtx = null;

function playHboSoundmark() {
  try {
    if (!hboAudioCtx) {
      hboAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (hboAudioCtx.state === 'suspended') {
      hboAudioCtx.resume();
    }
    const t0 = hboAudioCtx.currentTime;

    // 1. Analog White Noise static rush (0.0s to 1.6s)
    const bufferSize = hboAudioCtx.sampleRate * 1.8;
    const noiseBuffer = hboAudioCtx.createBuffer(1, bufferSize, hboAudioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = hboAudioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = hboAudioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, t0);
    noiseFilter.frequency.exponentialRampToValueAtTime(320, t0 + 1.6);

    const noiseGain = hboAudioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.09, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(hboAudioCtx.destination);
    whiteNoise.start(t0);
    whiteNoise.stop(t0 + 1.6);

    // 2. The Iconic Deep HBO Resonant Chord
    // Root C2 (65.41 Hz), 5th G2 (98.0 Hz), octave C3 (130.81 Hz), chime C5 (523.25 Hz)
    const frequencies = [65.41, 98.00, 130.81, 261.63, 523.25];
    const swellStart = t0 + 0.85;
    const duration = 3.6;

    frequencies.forEach((freq, idx) => {
      const osc = hboAudioCtx.createOscillator();
      const gain = hboAudioCtx.createGain();
      osc.type = idx === 0 ? 'sine' : (idx < 3 ? 'triangle' : 'sine');
      osc.frequency.setValueAtTime(freq, swellStart);

      gain.gain.setValueAtTime(0.0001, swellStart);
      gain.gain.exponentialRampToValueAtTime(0.12 / (idx + 1), swellStart + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, swellStart + duration);

      osc.connect(gain);
      gain.connect(hboAudioCtx.destination);
      osc.start(swellStart);
      osc.stop(swellStart + duration);
    });

  } catch (e) {
    console.warn("Audio synthesis unavailable:", e);
  }
}

// Analog TV Static Canvas Noise
function initHboCanvasNoise() {
  const canvas = document.getElementById('hbo-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  function resize() {
    canvas.width = Math.floor(window.innerWidth / 3);
    canvas.height = Math.floor(window.innerHeight / 3);
  }
  resize();
  window.addEventListener('resize', resize);

  let animId = null;
  function renderStatic() {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;

    for (let i = 0; i < len; i++) {
      buffer32[i] = Math.random() < 0.5 ? 0xffffffff : 0xff000000;
    }
    ctx.putImageData(imgData, 0, 0);
    animId = requestAnimationFrame(renderStatic);
  }

  renderStatic();
  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

// Dismiss HBO screen and trigger the cinematic landing boot animation
function dismissHboIntro() {
  const screen = document.getElementById('hbo-intro-screen');
  if (!screen) return;
  screen.style.opacity = '0';
  screen.style.pointerEvents = 'none';
  setTimeout(() => {
    screen.style.display = 'none';
  }, 1000);

  // Trigger Landing Container Animation
  const landing = document.getElementById('landing-container');
  if (landing) {
    landing.classList.remove('opacity-0');
    landing.classList.add('animate-landing-boot');
  }

  // Ignite 3D chamber
  if (window.initAtmosphereChamber) {
    window.initAtmosphereChamber();
  }

  // Wake up HUD counters
  if (window.wakeUpHudCounters) {
    window.wakeUpHudCounters();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const stopNoise = initHboCanvasNoise();

  const enterBtn = document.getElementById('hbo-enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      playHboSoundmark();
      dismissHboIntro();
      if (stopNoise) stopNoise();
    });
  }

  // Auto transition after 3.5s
  const autoTimer = setTimeout(() => {
    dismissHboIntro();
    if (stopNoise) stopNoise();
  }, 3500);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      clearTimeout(autoTimer);
      playHboSoundmark();
      dismissHboIntro();
      if (stopNoise) stopNoise();
    }
  }, { once: true });
});

window.playHboSoundmark = playHboSoundmark;
window.dismissHboIntro = dismissHboIntro;
