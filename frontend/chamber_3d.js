/**
 * Multi-Dimensional 3D Atmospheric Chamber Simulation
 * Simulates real-time gaseous particulate vectors (CO & ML Inferred CO2)
 * in an interactive isometric 3D space with particle physics & scroll-reactive tilt.
 */

let chamberCanvas = null;
let chamberCtx = null;
let particles = [];
let rotX = 0.35;
let rotY = -0.55;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

let envParams = {
  co: 3.04,
  co2: 581.0,
  temp: 27.9,
  hum: 62.0
};

class GasParticle {
  constructor(type) {
    this.type = type; // 'CO' (crimson) or 'CO2' (phosphor green)
    this.reset();
  }

  reset() {
    const size = 160;
    this.x = (Math.random() - 0.5) * size;
    this.y = (Math.random() - 0.5) * size;
    this.z = (Math.random() - 0.5) * size;
    
    // Velocity influenced by temperature (buoyancy)
    const speed = 0.4 + (envParams.temp / 50.0) * 0.8;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = -(Math.random() * 0.5 + 0.2) * (1 + envParams.temp / 40.0); // upward convection
    this.vz = (Math.random() - 0.5) * speed;
    
    this.radius = this.type === 'CO' ? 2.5 : 1.8;
    this.alpha = 0.3 + Math.random() * 0.6;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;

    const bound = 90;
    if (this.y < -bound) this.y = bound;
    if (this.x < -bound || this.x > bound) this.vx *= -1;
    if (this.z < -bound || this.z > bound) this.vz *= -1;
  }
}

function initAtmosphereChamber() {
  chamberCanvas = document.getElementById('chamber-3d-canvas');
  if (!chamberCanvas) return;
  chamberCtx = chamberCanvas.getContext('2d');

  function resize() {
    const rect = chamberCanvas.parentElement.getBoundingClientRect();
    chamberCanvas.width = rect.width * window.devicePixelRatio;
    chamberCanvas.height = rect.height * window.devicePixelRatio;
    chamberCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  resize();
  window.addEventListener('resize', resize);

  // Mouse drag orbit controls
  chamberCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    rotY += dx * 0.008;
    rotX += dy * 0.008;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Scroll tilt reaction
  window.addEventListener('scroll', () => {
    const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    rotY = -0.55 + scrollPct * 1.5;
  }, { passive: true });

  rebuildParticles();
  requestAnimationFrame(renderChamber);
}

function rebuildParticles() {
  particles = [];
  // Number of CO particles scaled from sensed CO ppm
  const numCo = Math.min(120, Math.max(15, Math.floor(envParams.co * 3.5)));
  // Number of CO2 particles scaled from predicted CO2
  const numCo2 = Math.min(220, Math.max(30, Math.floor(envParams.co2 / 12.0)));

  for (let i = 0; i < numCo; i++) particles.push(new GasParticle('CO'));
  for (let i = 0; i < numCo2; i++) particles.push(new GasParticle('CO2'));
}

function updateChamberParams(co, co2, temp, hum) {
  envParams.co = co;
  envParams.co2 = co2;
  envParams.temp = temp;
  envParams.hum = hum;
  rebuildParticles();
}

function project3D(x, y, z, cx, cy, fov = 320) {
  // Rotate around Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;

  // Rotate around X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX + 380; // camera distance

  const scale = fov / z2;
  return {
    px: cx + x1 * scale,
    py: cy + y2 * scale,
    scale: scale,
    depth: z2
  };
}

function renderChamber() {
  if (!chamberCtx || !chamberCanvas) return;
  const w = chamberCanvas.width / window.devicePixelRatio;
  const h = chamberCanvas.height / window.devicePixelRatio;
  const cx = w / 2;
  const cy = h / 2;

  chamberCtx.clearRect(0, 0, w, h);

  // Draw 3D wireframe bounding cube
  const b = 90;
  const corners = [
    [-b,-b,-b], [b,-b,-b], [b,b,-b], [-b,b,-b],
    [-b,-b,b],  [b,-b,b],  [b,b,b],  [-b,b,b]
  ];
  const projectedCorners = corners.map(c => project3D(c[0], c[1], c[2], cx, cy));

  const edges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
  ];

  chamberCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  chamberCtx.lineWidth = 1;
  edges.forEach(([i, j]) => {
    chamberCtx.beginPath();
    chamberCtx.moveTo(projectedCorners[i].px, projectedCorners[i].py);
    chamberCtx.lineTo(projectedCorners[j].px, projectedCorners[j].py);
    chamberCtx.stroke();
  });

  // Sort particles by depth
  const projectedParticles = particles.map(p => {
    p.update();
    const proj = project3D(p.x, p.y, p.z, cx, cy);
    return { p, proj };
  });

  projectedParticles.sort((a, b) => b.proj.depth - a.proj.depth);

  // Render particles
  projectedParticles.forEach(({ p, proj }) => {
    if (proj.scale <= 0) return;
    const r = Math.max(1, p.radius * proj.scale * 1.5);
    chamberCtx.beginPath();
    chamberCtx.arc(proj.px, proj.py, r, 0, Math.PI * 2);

    if (p.type === 'CO') {
      chamberCtx.fillStyle = `rgba(255, 69, 58, ${p.alpha})`;
      chamberCtx.shadowColor = '#ff453a';
      chamberCtx.shadowBlur = 8;
    } else {
      chamberCtx.fillStyle = `rgba(0, 255, 102, ${p.alpha * 0.75})`;
      chamberCtx.shadowColor = '#00ff66';
      chamberCtx.shadowBlur = 5;
    }
    chamberCtx.fill();
    chamberCtx.shadowBlur = 0;
  });

  requestAnimationFrame(renderChamber);
}

window.initAtmosphereChamber = initAtmosphereChamber;
window.updateChamberParams = updateChamberParams;
