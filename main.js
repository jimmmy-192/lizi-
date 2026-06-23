const canvas = document.querySelector("#particleCanvas");
const ctx = canvas.getContext("2d", { alpha: true });

const CONFIG = {
  sampleGap: 2,
  maxParticleSamples: 95000,
  mobileMaxParticleSamples: 62000,
  maxDevicePixelRatio: 1.5,
  mobileMaxDevicePixelRatio: 1.25,
  maxCanvasPixels: 1800000,
  particleSize: 1.5,
  stableZoneRatio: 0.45,
  transitionRatio: 0.8,

  globalMoveStrength: 8,
  globalFlowStrength: 0.25,
  globalFlowSpeed: 0.003,

  noiseScale: 0.006,
  flowSpeed: 0.004,
  noiseStrength: 1.0,

  centerCohesion: 0.08,
  edgeCohesion: 0.025,
  edgeScatterStrength: 0.8,
  stableCohesionMultiplier: 3,
  stableLocalFlowFloor: 0,
  stableScatterRangeScale: 0.16,
  stableSpeedLimit: 0.28,

  baseScatterRange: 3,
  edgeScatterRange: 28,
  returnForce: 0.05,

  damping: 0.9,
  brightness: 1,
  overallBrightness: 1,

  glowIntensity: 4,
  glowCenterFloor: 0.12,
  glowAlphaScale: 0.11,
  glowRadiusMin: 2.5,
  glowRadiusMax: 10,
  glowSampleRate: 0.38,

  stableHighlightThreshold: 0.48,
  stableHighlightAlpha: 0.92,
  stableHighlightWhiteMix: 0.78,
  stableHighlightMinRadius: 0.62,
  stableHighlightRadiusScale: 0.92,
  stableHighlightTransitionFade: 0.18,

  edgeGatherStrength: 4,
  edgeGatherCount: 4,
  edgeGatherWidth: 0.72,
  edgeGatherSpeed: 0.0035,
  edgeGatherDrift: 0.9,
  edgeGatherForce: 0.42,
  edgeGatherRadialMix: 0.28,

  edgeVeilStrength: 1.2,
  edgeVeilCount: 6,
  edgeVeilWidth: 0.46,
  edgeVeilSpeed: 0.0024,
  edgeVeilOutwardForce: 0.58,
  edgeVeilTangentForce: 0.38,
  edgeVeilGatherForce: 0.32,
  edgeVeilRangeBonus: 38,

  edgeShellDensity: 3.9,
  edgeShellInnerThreshold: 0.16,
  edgeShellOutwardMin: 2,
  edgeShellOutwardMax: 54,
  edgeShellTangentSpread: 30,
  edgeShellAlpha: 0.76,
  edgeShellRadius: 0.66,
  edgeShellNoiseScale: 0.013,
  edgeShellPatchCount: 6,
  edgeShellPatchBoost: 1.85,
  edgeShellSparseCutoff: 0.14,
  edgeShellGlowAlpha: 0.32,
  edgeShellGlowBlur: 5,
  edgeShellWaveStrength: 8,
  edgeShellPatchLift: 14,

  edgeWhiteAccentRate: 0.24,
  edgeWhiteAlpha: 0.58,
  edgeWhiteRadiusScale: 0.72,
  edgeWhiteOutwardOffset: 1.8,
  edgeWhiteVeilBoost: 0.85,
  edgeWhiteDarkBoost: 0.55,

  edgeStreamRate: 0.2,
  edgeStreamSegments: 3,
  edgeStreamSpacing: 2.8,
  edgeStreamAlpha: 0.3,
  edgeStreamRadiusScale: 0.48,
  edgeStreamVeilBoost: 0.9,
  edgeStreamDarkBoost: 0.45,
  edgeStreamMinSpeed: 0.08,
};

const elements = {
  imageInput: document.querySelector("#imageInput"),
  regenerateButton: document.querySelector("#regenerateButton"),
  particleCount: document.querySelector("#particleCount"),
  stableZoneRatio: document.querySelector("#stableZoneRatio"),
  transitionRatio: document.querySelector("#transitionRatio"),
  particleSize: document.querySelector("#particleSize"),
  overallBrightness: document.querySelector("#overallBrightness"),
  glowIntensity: document.querySelector("#glowIntensity"),
  edgeGatherStrength: document.querySelector("#edgeGatherStrength"),
};

const labels = {
  stableZoneRatio: document.querySelector("#stableZoneRatioValue"),
  transitionRatio: document.querySelector("#transitionRatioValue"),
  particleSize: document.querySelector("#particleSizeValue"),
  overallBrightness: document.querySelector("#overallBrightnessValue"),
  glowIntensity: document.querySelector("#glowIntensityValue"),
  edgeGatherStrength: document.querySelector("#edgeGatherStrengthValue"),
};

const TWO_PI = Math.PI * 2;

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  particles: [],
  edgeShellParticles: [],
  imageLayer: null,
  currentSource: null,
  animationId: 0,
  lastFrame: performance.now(),
  time: 0,
  config: null,
  resizeTimer: 0,
  regenerateTimer: 0,
  performance: {
    quality: 1,
    frameCount: 0,
    elapsed: 0,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function lerpAngle(a, b, t) {
  return a + angleDelta(b, a) * t;
}

function rgb(r, g, b) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function rgba(r, g, b, a) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function luminanceOf(r, g, b) {
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const x00 = lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), ux);
  const x10 = lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), ux);
  const x01 = lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), ux);
  const x11 = lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), ux);
  const y0 = lerp(x00, x10, uy);
  const y1 = lerp(x01, x11, uy);
  return lerp(y0, y1, uz);
}

function fbm(x, y, z) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < 4; i += 1) {
    value += valueNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / total;
}

function createEdgeGatherFields(config, time) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);

  if (amount <= 0) {
    return [];
  }

  const fields = [];
  const count = Math.max(1, Math.round(config.edgeGatherCount));
  const fieldTime = time * config.edgeGatherSpeed;

  for (let i = 0; i < count; i += 1) {
    const baseAngle = (i / count) * TWO_PI;
    const direction = i % 2 === 0 ? 1 : -1;
    const driftNoise = fbm(i * 9.17, fieldTime * 0.72, 18.3);
    const phaseNoise = fbm(i * 5.41, 29.6, fieldTime * 1.15);
    const drift =
      (driftNoise - 0.5) * config.edgeGatherDrift +
      Math.sin(fieldTime * 0.88 + i * 1.73) * config.edgeGatherDrift * 0.28;
    const orbit = direction * fieldTime * (0.34 + i * 0.045);
    const pulse = clamp(
      0.5 + Math.sin(fieldTime * 2.4 + i * 1.21) * 0.34 + (phaseNoise - 0.5) * 0.32,
      0,
      1,
    );
    const breath = Math.sin(fieldTime * 2.9 + i * 1.57 + phaseNoise * 1.2);

    fields.push({
      angle: baseAngle + drift + orbit,
      pulse,
      breath,
    });
  }

  return fields;
}

function getEdgeGatherForce(particle, fields, config) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const edgeFactor = smoothstep(0.05, 1, particle.edgeWeight);

  if (amount <= 0 || edgeFactor <= 0 || fields.length === 0) {
    return { x: 0, y: 0 };
  }

  const tangentX = -particle.outwardY;
  const tangentY = particle.outwardX;
  const particleVariation = 0.82 + particle.flowSeed * 0.36;
  let forceX = 0;
  let forceY = 0;

  for (const field of fields) {
    const delta = angleDelta(particle.radialAngle, field.angle);
    const normalizedDelta = clamp(delta / config.edgeGatherWidth, -1, 1);
    const influence = Math.exp(
      -(delta * delta) / Math.max(0.001, config.edgeGatherWidth * config.edgeGatherWidth),
    );

    if (influence <= 0.018) {
      continue;
    }

    const phaseStrength = 0.38 + field.pulse * 0.62;
    const tangentPull = -normalizedDelta * influence * phaseStrength;
    const radialBreath =
      field.breath *
      influence *
      phaseStrength *
      config.edgeGatherRadialMix *
      (0.55 + particle.flowSeed * 0.45);

    forceX += tangentX * tangentPull + particle.outwardX * radialBreath;
    forceY += tangentY * tangentPull + particle.outwardY * radialBreath;
  }

  const scale = amount * config.edgeGatherForce * edgeFactor * particleVariation;

  return {
    x: forceX * scale,
    y: forceY * scale,
  };
}

function createEdgeVeilFields(config, time) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);

  if (amount <= 0) {
    return [];
  }

  const count = Math.max(1, Math.round(config.edgeVeilCount));
  const fields = [];
  const fieldTime = time * config.edgeVeilSpeed;

  for (let i = 0; i < count; i += 1) {
    const baseAngle = (i / count) * TWO_PI;
    const wander =
      (fbm(i * 4.73, fieldTime * 0.86, 12.1) - 0.5) * 1.45 +
      Math.sin(fieldTime * (1.12 + i * 0.05) + i * 1.63) * 0.38;
    const slowOrbit = fieldTime * (0.34 + hash3(i, 7.2, 1.8) * 0.28);
    const pulseNoise = fbm(i * 8.21, 18.4, fieldTime * 1.35);
    const pulseWave = Math.sin(fieldTime * (2.4 + i * 0.17) + i * 2.11) * 0.28;
    const pulse = clamp(0.52 + (pulseNoise - 0.5) * 0.72 + pulseWave, 0, 1);

    fields.push({
      angle: baseAngle + wander + slowOrbit,
      width: config.edgeVeilWidth * (0.72 + hash3(i, 9.8, 2.4) * 0.72),
      pulse,
      tangentSign: hash3(i, 3.7, 12.6) > 0.5 ? 1 : -1,
      shear: 0.54 + hash3(i, 5.3, 18.9) * 0.74,
      phase: hash3(i, 12.8, 23.4) * TWO_PI,
    });
  }

  return fields;
}

function getEdgeVeilPatch(particle, field) {
  const delta = angleDelta(particle.radialAngle, field.angle);
  const influence = Math.exp(
    -(delta * delta) / Math.max(0.001, field.width * field.width),
  );

  if (influence <= 0.012) {
    return null;
  }

  const normalizedDelta = clamp(delta / field.width, -1, 1);
  const featherTexture =
    0.66 +
    Math.sin(field.phase + particle.radialAngle * 7.3 + particle.flowSeed * 5.1) * 0.18 +
    Math.sin(field.phase * 0.7 + particle.normalizedRadius * 11.8) * 0.16;

  return {
    normalizedDelta,
    weight: influence * field.pulse * clamp(featherTexture, 0.32, 1.12),
  };
}

function getEdgeVeilInfluence(particle, fields, config) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const edgeFactor = smoothstep(0.18, 1, particle.edgeWeight);

  if (amount <= 0 || edgeFactor <= 0 || fields.length === 0) {
    return 0;
  }

  let influence = 0;

  for (const field of fields) {
    const patch = getEdgeVeilPatch(particle, field);

    if (patch) {
      influence += patch.weight;
    }
  }

  return clamp(influence * amount * edgeFactor, 0, 1.6);
}

function getEdgeStreamDirection(particle, edgeVeilFields, config) {
  const speed = Math.hypot(particle.vx, particle.vy);

  if (speed >= config.edgeStreamMinSpeed) {
    return {
      x: particle.vx / speed,
      y: particle.vy / speed,
      strength: clamp(speed / 2.2, 0.2, 1),
    };
  }

  const tangentX = -particle.outwardY;
  const tangentY = particle.outwardX;
  let directionX = 0;
  let directionY = 0;
  let influence = 0;

  for (const field of edgeVeilFields) {
    const patch = getEdgeVeilPatch(particle, field);

    if (!patch) {
      continue;
    }

    const tangentSign = field.tangentSign || 1;
    const weight = patch.weight * (0.7 + field.pulse * 0.3);
    directionX += (tangentX * tangentSign + particle.outwardX * 0.35) * weight;
    directionY += (tangentY * tangentSign + particle.outwardY * 0.35) * weight;
    influence += weight;
  }

  if (influence <= 0.001) {
    const fallbackSign = particle.streamOffsetSeed > 0.5 ? 1 : -1;
    return {
      x: tangentX * fallbackSign,
      y: tangentY * fallbackSign,
      strength: 0.22,
    };
  }

  const length = Math.hypot(directionX, directionY) || 1;

  return {
    x: directionX / length,
    y: directionY / length,
    strength: clamp(influence, 0.24, 1),
  };
}

function getEdgeVeilForce(particle, fields, config) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const edgeFactor = smoothstep(0.18, 1, particle.edgeWeight);

  if (amount <= 0 || edgeFactor <= 0 || fields.length === 0) {
    return { x: 0, y: 0 };
  }

  let forceX = 0;
  let forceY = 0;
  let rangeInfluence = 0;
  const flowVariation = 0.72 + particle.flowSeed * 0.56;
  const tangentX = -particle.outwardY;
  const tangentY = particle.outwardX;

  for (const field of fields) {
    const patch = getEdgeVeilPatch(particle, field);

    if (!patch) {
      continue;
    }

    const patchWeight = patch.weight;
    const outwardPush =
      patchWeight *
      config.edgeVeilOutwardForce *
      (0.62 + particle.flowSeed * 0.38);
    const tangentDrift =
      patchWeight *
      config.edgeVeilTangentForce *
      field.tangentSign *
      field.shear;
    const angularGather =
      -patch.normalizedDelta *
      patchWeight *
      config.edgeVeilGatherForce *
      (0.72 + field.pulse * 0.28);

    forceX += particle.outwardX * outwardPush + tangentX * (tangentDrift + angularGather);
    forceY += particle.outwardY * outwardPush + tangentY * (tangentDrift + angularGather);
    rangeInfluence += patchWeight;
  }

  const scale = amount * config.edgeVeilStrength * edgeFactor * flowVariation;
  const rangeBonus = clamp(
    rangeInfluence * amount * edgeFactor * config.edgeVeilRangeBonus,
    0,
    config.edgeVeilRangeBonus,
  );

  return {
    x: forceX * scale,
    y: forceY * scale,
    rangeBonus,
  };
}

function readConfig() {
  const stableZoneRatio = Number(elements.stableZoneRatio.value);
  const transitionRatio = Number(elements.transitionRatio.value);
  const particleSizeValue = Number(elements.particleSize.value);
  const overallBrightness = Number(elements.overallBrightness.value);
  const glowIntensity = Number(elements.glowIntensity.value);
  const edgeGatherStrength = Number(elements.edgeGatherStrength.value);
  const particleSize = lerp(0.9, 1.9, particleSizeValue / 10);

  return {
    ...CONFIG,
    stableZoneRatio,
    transitionRatio,
    particleSize,
    overallBrightness,
    glowIntensity,
    edgeGatherStrength,
  };
}

function applyOverallBrightness(config) {
  canvas.style.filter = `brightness(${config.overallBrightness})`;
}

function updateLabels() {
  labels.stableZoneRatio.textContent = Number(elements.stableZoneRatio.value).toFixed(2);
  labels.transitionRatio.textContent = Number(elements.transitionRatio.value).toFixed(2);
  labels.particleSize.textContent = elements.particleSize.value;
  labels.overallBrightness.textContent = Number(elements.overallBrightness.value).toFixed(2);
  labels.glowIntensity.textContent = elements.glowIntensity.value;
  labels.edgeGatherStrength.textContent = elements.edgeGatherStrength.value;
}

function getRenderDpr() {
  const rawDpr = window.devicePixelRatio || 1;
  const dprCap =
    window.innerWidth <= 760 ? CONFIG.mobileMaxDevicePixelRatio : CONFIG.maxDevicePixelRatio;
  const pixelCap = Math.sqrt(CONFIG.maxCanvasPixels / Math.max(1, window.innerWidth * window.innerHeight));

  return clamp(Math.min(rawDpr, dprCap, pixelCap), 1, dprCap);
}

function getTargetParticleSamples(config) {
  return state.width <= 760 ? config.mobileMaxParticleSamples : config.maxParticleSamples;
}

function updatePerformanceQuality(frameTime) {
  const performanceState = state.performance;
  performanceState.frameCount += 1;
  performanceState.elapsed += frameTime;

  if (performanceState.elapsed < 1000) {
    return;
  }

  const fps = (performanceState.frameCount * 1000) / performanceState.elapsed;

  if (fps < 28) {
    performanceState.quality = Math.max(0.48, performanceState.quality - 0.16);
  } else if (fps > 50) {
    performanceState.quality = Math.min(1, performanceState.quality + 0.08);
  }

  performanceState.frameCount = 0;
  performanceState.elapsed = 0;
}

function getRuntimeQuality() {
  return state.performance.quality;
}

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = getRenderDpr();
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function createDefaultSource() {
  const source = document.createElement("canvas");
  const sourceCtx = source.getContext("2d");
  source.width = 620;
  source.height = 620;

  sourceCtx.clearRect(0, 0, source.width, source.height);

  sourceCtx.save();
  sourceCtx.beginPath();
  sourceCtx.roundRect(174, 116, 272, 382, 36);
  sourceCtx.clip();

  const card = sourceCtx.createLinearGradient(174, 116, 446, 498);
  card.addColorStop(0, "#f5f1de");
  card.addColorStop(0.28, "#8bd0ff");
  card.addColorStop(0.62, "#285b8a");
  card.addColorStop(1, "#0d2235");
  sourceCtx.fillStyle = card;
  sourceCtx.fillRect(174, 116, 272, 382);

  for (let i = 0; i < 18; i += 1) {
    sourceCtx.strokeStyle = `rgba(${lerp(255, 80, i / 18)}, ${lerp(230, 176, i / 18)}, ${lerp(92, 245, i / 18)}, 0.58)`;
    sourceCtx.lineWidth = 5;
    sourceCtx.beginPath();
    sourceCtx.arc(310, 232, 58 + i * 5.2, Math.PI * 0.08, Math.PI * 1.38);
    sourceCtx.stroke();
  }

  sourceCtx.fillStyle = "rgba(255, 255, 255, 0.93)";
  sourceCtx.beginPath();
  sourceCtx.arc(310, 302, 104, 0, TWO_PI);
  sourceCtx.fill();

  sourceCtx.save();
  sourceCtx.beginPath();
  sourceCtx.arc(310, 302, 90, 0, TWO_PI);
  sourceCtx.clip();

  const lens = sourceCtx.createLinearGradient(230, 216, 410, 392);
  lens.addColorStop(0, "#f7e7c6");
  lens.addColorStop(0.35, "#79c7ff");
  lens.addColorStop(0.7, "#153b61");
  lens.addColorStop(1, "#08131f");
  sourceCtx.fillStyle = lens;
  sourceCtx.fillRect(220, 212, 180, 180);

  sourceCtx.fillStyle = "rgba(255, 245, 225, 0.9)";
  sourceCtx.beginPath();
  sourceCtx.ellipse(286, 292, 30, 74, -0.65, 0, TWO_PI);
  sourceCtx.fill();
  sourceCtx.fillStyle = "rgba(128, 76, 45, 0.85)";
  sourceCtx.beginPath();
  sourceCtx.ellipse(334, 284, 38, 88, 0.44, 0, TWO_PI);
  sourceCtx.fill();
  sourceCtx.fillStyle = "rgba(255, 255, 255, 0.42)";
  sourceCtx.fillRect(236, 226, 164, 14);
  sourceCtx.restore();

  sourceCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  sourceCtx.lineWidth = 7;
  sourceCtx.beginPath();
  sourceCtx.arc(310, 302, 104, 0, TWO_PI);
  sourceCtx.stroke();

  sourceCtx.fillStyle = "rgba(255, 255, 255, 0.94)";
  sourceCtx.font = "900 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  sourceCtx.textAlign = "center";
  sourceCtx.textBaseline = "middle";
  sourceCtx.fillText("CAPTURE", 310, 440);
  sourceCtx.restore();

  sourceCtx.strokeStyle = "rgba(255, 255, 255, 0.56)";
  sourceCtx.lineWidth = 3;
  sourceCtx.beginPath();
  sourceCtx.roundRect(174, 116, 272, 382, 36);
  sourceCtx.stroke();

  return source;
}

function getFittedImageRect(source) {
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const panelReservedWidth = state.width > 900 ? 400 : 0;
  const maxWidth = Math.max(260, state.width - panelReservedWidth - 80);
  const maxHeight = Math.max(240, state.height * (state.width > 760 ? 0.82 : 0.54));
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1.35);
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  const centerX = state.width > 900 ? (state.width - panelReservedWidth) * 0.5 : state.width * 0.5;
  const centerY = state.width > 760 ? state.height * 0.52 : state.height * 0.33;

  return {
    width,
    height,
    offsetX: Math.round(centerX - width / 2),
    offsetY: Math.round(centerY - height / 2),
  };
}

function buildParticlesFromSource(source) {
  if (!source || state.width === 0 || state.height === 0) {
    return;
  }

  const config = readConfig();
  const rect = getFittedImageRect(source);
  const sampleCanvas = document.createElement("canvas");
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCanvas.width = rect.width;
  sampleCanvas.height = rect.height;
  sampleCtx.clearRect(0, 0, rect.width, rect.height);
  sampleCtx.drawImage(source, 0, 0, rect.width, rect.height);

  const imageData = sampleCtx.getImageData(0, 0, rect.width, rect.height);
  const data = imageData.data;
  const targetSamples = getTargetParticleSamples(config);
  const gap = Math.max(
    config.sampleGap,
    Math.ceil(Math.sqrt((rect.width * rect.height) / targetSamples)),
  );

  const particles = [];
  const centerX = rect.offsetX + rect.width / 2;
  const centerY = rect.offsetY + rect.height / 2;
  const distanceToCorner = Math.hypot(rect.width / 2, rect.height / 2) || 1;
  const visibleRadius = lerp(config.stableZoneRatio, 1, config.transitionRatio / 2);
  state.imageLayer = {
    source,
    rect,
    centerX,
    centerY,
    stableRadius: distanceToCorner * config.stableZoneRatio,
  };

  for (let y = 0; y < rect.height; y += gap) {
    for (let x = 0; x < rect.width; x += gap) {
      const index = (y * rect.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha <= 35) {
        continue;
      }

      const baseX = rect.offsetX + x;
      const baseY = rect.offsetY + y;
      const radialX = baseX - centerX;
      const radialY = baseY - centerY;
      const radialLength = Math.hypot(radialX, radialY) || 1;
      const normalizedRadius = clamp(radialLength / distanceToCorner, 0, 1);

      if (normalizedRadius > visibleRadius) {
        continue;
      }

      const edgeWeight =
        visibleRadius <= config.stableZoneRatio
          ? 0
          : smoothstep(config.stableZoneRatio, visibleRadius, normalizedRadius);
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = luminanceOf(r, g, b);
      const alphaRatio = alpha / 255;
      const seed = hash3(x, y, particles.length * 0.37) * 1000;
      const radius =
        (config.particleSize * 0.5) *
        (0.92 + luminance * 0.08) *
        (0.96 + hash3(x, y, 5.2) * 0.08);

      particles.push({
        baseX,
        baseY,
        x: baseX,
        y: baseY,
        vx: 0,
        vy: 0,
        color: rgb(r, g, b),
        r,
        g,
        b,
        alpha: clamp(alphaRatio * config.brightness, 0, 1),
        radius,
        luminance,
        normalizedRadius,
        edgeWeight,
        stableWeight: 1 - edgeWeight,
        radialAngle: Math.atan2(radialY, radialX),
        outwardX: radialX / radialLength,
        outwardY: radialY / radialLength,
        seed,
        flowSeed: hash3(x, y, 14.2),
        glowSeed: hash3(x, y, 9.7),
        stableHighlightSeed: hash3(x, y, 16.8),
        stableHighlightAlphaSeed: hash3(x, y, 18.6),
        stableHighlightOffsetSeed: hash3(x, y, 20.4),
        whiteSeed: hash3(x, y, 22.5),
        whiteAlphaSeed: hash3(x, y, 31.8),
        whiteOffsetSeed: hash3(x, y, 45.3),
        streamSeed: hash3(x, y, 52.6),
        streamAlphaSeed: hash3(x, y, 61.4),
        streamOffsetSeed: hash3(x, y, 73.9),
      });
    }
  }

  state.particles = particles;
  state.edgeShellParticles = createEdgeShellParticles(particles, config);
  state.config = config;
  applyOverallBrightness(config);
  elements.particleCount.textContent = particles.length.toLocaleString("zh-CN");
}

function regenerateParticles() {
  buildParticlesFromSource(state.currentSource);
}

function scheduleRegenerate() {
  window.clearTimeout(state.regenerateTimer);
  state.regenerateTimer = window.setTimeout(regenerateParticles, 120);
}

function createEdgeShellParticles(particles, config) {
  const shellParticles = [];

  particles.forEach((particle, sourceIndex) => {
    if (particle.edgeWeight < config.edgeShellInnerThreshold) {
      return;
    }

    const edgeFactor = smoothstep(config.edgeShellInnerThreshold, 1, particle.edgeWeight);
    const densityNoise = fbm(
      particle.baseX * config.edgeShellNoiseScale,
      particle.baseY * config.edgeShellNoiseScale,
      particle.seed * 0.003,
    );
    const rimBias = smoothstep(0.36, 1, particle.edgeWeight);
    const densityTexture =
      0.42 +
      densityNoise * 0.78 +
      Math.sin(particle.radialAngle * 5.1 + densityNoise * 3.4) * 0.12;
    const densityWeight = edgeFactor * (densityTexture + rimBias * 0.28);

    if (densityWeight < config.edgeShellSparseCutoff) {
      return;
    }

    const copyTarget = clamp(
      densityWeight * config.edgeShellDensity * (0.72 + rimBias * 0.46),
      0,
      5,
    );
    const guaranteedCopies = Math.floor(copyTarget);
    const extraCopy = hash3(particle.seed, sourceIndex, 81.7) < copyTarget - guaranteedCopies ? 1 : 0;
    const copyCount = clamp(guaranteedCopies + extraCopy, 1, 5);

    for (let i = 0; i < copyCount; i += 1) {
      const shellSeed = hash3(particle.seed, i * 17.3, sourceIndex * 0.11);
      const shellSeedB = hash3(particle.seed, i * 23.9, 41.2);
      const shellSeedC = hash3(particle.seed, i * 31.7, 67.4);
      const shellSeedD = hash3(particle.seed, i * 43.1, 93.6);
      const outwardT = Math.pow(shellSeed, 0.48);
      const outwardOffset = lerp(
        config.edgeShellOutwardMin,
        config.edgeShellOutwardMax,
        clamp(outwardT * (0.52 + edgeFactor * 0.48 + rimBias * 0.22), 0, 1),
      );
      const tangentOffset =
        (shellSeedB * 2 - 1) *
        config.edgeShellTangentSpread *
        (0.34 + edgeFactor * 0.52 + rimBias * 0.24);
      const alpha =
        particle.alpha *
        config.edgeShellAlpha *
        densityWeight *
        (0.78 + shellSeedC * 0.42 + rimBias * 0.28);
      const radius =
        config.edgeShellRadius *
        (0.74 + shellSeedD * 0.5) *
        (0.88 + edgeFactor * 0.2 + rimBias * 0.1);
      const tint = shellSeedC;

      shellParticles.push({
        sourceIndex,
        edgeWeight: particle.edgeWeight,
        normalizedRadius: particle.normalizedRadius,
        radialAngle: particle.radialAngle,
        outwardOffset,
        tangentOffset,
        alpha: clamp(alpha, 0, 0.9),
        radius: Math.max(0.22, radius),
        densityWeight,
        rimBias,
        seed: shellSeed,
        motionSeed: shellSeedB,
        alphaSeed: shellSeedC,
        color: rgb(lerp(236, 255, tint), lerp(238, 255, tint), lerp(232, 252, tint)),
      });
    }
  });

  return shellParticles;
}

function createEdgeShellPatchFields(config, time) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);

  if (amount <= 0) {
    return [];
  }

  const fields = [];
  const count = Math.max(1, Math.round(config.edgeShellPatchCount));
  const fieldTime = time * config.edgeVeilSpeed * 0.9;

  for (let i = 0; i < count; i += 1) {
    const baseAngle = (i / count) * TWO_PI;
    const wander =
      (fbm(i * 6.31, fieldTime * 0.78, 31.4) - 0.5) * 1.55 +
      Math.sin(fieldTime * (1.35 + i * 0.08) + i * 1.94) * 0.42;
    const pulseNoise = fbm(i * 9.17, 42.6, fieldTime * 1.22);
    const pulse = clamp(
      0.5 + (pulseNoise - 0.5) * 0.72 + Math.sin(fieldTime * 2.7 + i * 2.03) * 0.22,
      0,
      1,
    );

    fields.push({
      angle: baseAngle + wander + fieldTime * (0.22 + i * 0.025),
      width: 0.38 + hash3(i, 14.2, 5.8) * 0.34,
      pulse,
      phase: hash3(i, 28.5, 71.4) * TWO_PI,
    });
  }

  return fields;
}

function getEdgeShellPatchInfluence(shellParticle, fields, config) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);

  if (amount <= 0 || fields.length === 0) {
    return 0;
  }

  let influence = 0;

  for (const field of fields) {
    const delta = angleDelta(shellParticle.radialAngle, field.angle);
    const patchWeight = Math.exp(
      -(delta * delta) / Math.max(0.001, field.width * field.width),
    );

    if (patchWeight <= 0.012) {
      continue;
    }

    const texture =
      0.72 +
      Math.sin(field.phase + shellParticle.radialAngle * 6.8 + shellParticle.seed * 5.4) * 0.2 +
      Math.sin(field.phase * 0.7 + shellParticle.normalizedRadius * 12.3) * 0.18;
    influence += patchWeight * field.pulse * clamp(texture, 0.32, 1.18);
  }

  return clamp(influence * amount * config.edgeShellPatchBoost, 0, 2.2);
}

function getStableHighlightPaint(particle, config) {
  const stableWeight = particle.stableWeight ?? 1 - particle.edgeWeight;
  const stableFactor = smoothstep(
    config.stableHighlightTransitionFade,
    1,
    stableWeight,
  );

  if (stableFactor <= 0 || particle.luminance < config.stableHighlightThreshold) {
    return null;
  }

  const highlightWeight = smoothstep(
    config.stableHighlightThreshold,
    0.92,
    particle.luminance,
  );
  const alpha =
    particle.alpha *
    config.stableHighlightAlpha *
    stableFactor *
    highlightWeight *
    (0.74 + particle.stableHighlightAlphaSeed * 0.36);

  if (alpha <= 0.015) {
    return null;
  }

  const offsetAngle = particle.stableHighlightOffsetSeed * TWO_PI;
  const offsetDistance =
    particle.radius *
    0.08 *
    (particle.stableHighlightSeed * 2 - 1);
  const radius = Math.max(
    config.stableHighlightMinRadius,
    particle.radius *
      config.stableHighlightRadiusScale *
      (0.86 + particle.stableHighlightAlphaSeed * 0.18),
  );
  const whiteMix = config.stableHighlightWhiteMix * highlightWeight;

  return {
    alpha: clamp(alpha, 0, 0.88),
    color: rgb(
      lerp(particle.r, 255, whiteMix),
      lerp(particle.g, 255, whiteMix),
      lerp(particle.b, 255, whiteMix),
    ),
    radius,
    offsetX: Math.cos(offsetAngle) * offsetDistance,
    offsetY: Math.sin(offsetAngle) * offsetDistance,
  };
}

function updateParticle(particle, config, globalFlowX, globalFlowY, edgeGatherFields, edgeVeilFields, delta) {
  const dt = delta / 16.67;
  const time = state.time;
  const edgeWeight = particle.edgeWeight;
  const stableWeight = particle.stableWeight ?? 1 - edgeWeight;
  const centerWeight = 1 - edgeWeight;
  const globalFlowWeight = smoothstep(0, 1, edgeWeight);
  const anchorX = particle.baseX + globalFlowX * globalFlowWeight;
  const anchorY = particle.baseY + globalFlowY * globalFlowWeight;

  const cohesion = lerp(
    config.centerCohesion * config.stableCohesionMultiplier,
    config.edgeCohesion,
    edgeWeight,
  );
  const baseMaxOffset = lerp(
    config.baseScatterRange * config.stableScatterRangeScale,
    config.baseScatterRange + config.edgeScatterRange,
    edgeWeight,
  );
  const localNoise = fbm(
    particle.baseX * config.noiseScale,
    particle.baseY * config.noiseScale,
    time * config.flowSpeed + particle.seed * 0.013,
  );
  const localAngle = localNoise * TWO_PI * 2 * config.noiseStrength;
  const localX = Math.cos(localAngle);
  const localY = Math.sin(localAngle);
  const edgeNoise = fbm(
    particle.seed * 0.07,
    time * config.flowSpeed * 0.9,
    particle.normalizedRadius * 3.1,
  );
  const outwardPulse = (edgeNoise * 2 - 1) * config.edgeScatterStrength * edgeWeight;
  const stableFlowScale = lerp(config.stableLocalFlowFloor, 1, edgeWeight);

  particle.vx += localX * config.globalFlowStrength * stableFlowScale * (0.28 + centerWeight * 0.16) * dt;
  particle.vy += localY * config.globalFlowStrength * stableFlowScale * (0.28 + centerWeight * 0.16) * dt;
  particle.vx += localX * config.edgeScatterStrength * edgeWeight * 0.18 * dt;
  particle.vy += localY * config.edgeScatterStrength * edgeWeight * 0.18 * dt;
  particle.vx += particle.outwardX * outwardPulse * 0.08 * dt;
  particle.vy += particle.outwardY * outwardPulse * 0.08 * dt;

  const gatherForce = getEdgeGatherForce(particle, edgeGatherFields, config);
  particle.vx += gatherForce.x * dt;
  particle.vy += gatherForce.y * dt;

  const veilForce = getEdgeVeilForce(particle, edgeVeilFields, config);
  particle.vx += veilForce.x * dt;
  particle.vy += veilForce.y * dt;
  const maxOffset = baseMaxOffset + (veilForce.rangeBonus || 0);

  particle.vx += (anchorX - particle.x) * cohesion * dt;
  particle.vy += (anchorY - particle.y) * cohesion * dt;

  const dx = particle.x - anchorX;
  const dy = particle.y - anchorY;
  const distance = Math.hypot(dx, dy);

  if (distance > maxOffset) {
    const overshoot = distance - maxOffset;
    const pull = config.returnForce * (1 + overshoot / Math.max(1, maxOffset));
    particle.vx -= dx * pull * dt;
    particle.vy -= dy * pull * dt;
  }

  particle.vx *= Math.pow(config.damping, dt);
  particle.vy *= Math.pow(config.damping, dt);

  const speed = Math.hypot(particle.vx, particle.vy);
  const maxSpeed = lerp(config.stableSpeedLimit, 2.6, edgeWeight);
  if (speed > maxSpeed) {
    particle.vx = (particle.vx / speed) * maxSpeed;
    particle.vy = (particle.vy / speed) * maxSpeed;
  }

  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
}

function drawGlowLayer(config) {
  const glowAmount = clamp(config.glowIntensity / 10, 0, 1);

  if (glowAmount <= 0) {
    return;
  }

  const quality = getRuntimeQuality();
  const glowSampleRate = config.glowSampleRate * lerp(0.42, 1, quality);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;

  for (const particle of state.particles) {
    if (particle.edgeWeight <= 0) {
      continue;
    }

    if (particle.glowSeed > glowSampleRate) {
      continue;
    }

    const glowWeight = lerp(config.glowCenterFloor, 1, particle.edgeWeight);
    const luminanceWeight = smoothstep(0.08, 0.82, particle.luminance);
    const glowAlpha = particle.alpha * glowAmount * config.glowAlphaScale * glowWeight * luminanceWeight;

    if (glowAlpha <= 0.004) {
      continue;
    }

    const glowRadius =
      lerp(config.glowRadiusMin, config.glowRadiusMax, glowWeight) *
      (0.82 + luminanceWeight * 0.18);
    const glow = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      glowRadius,
    );

    glow.addColorStop(0, rgba(particle.r, particle.g, particle.b, glowAlpha));
    glow.addColorStop(0.48, rgba(particle.r, particle.g, particle.b, glowAlpha * 0.34));
    glow.addColorStop(1, rgba(particle.r, particle.g, particle.b, 0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, glowRadius, 0, TWO_PI);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

function drawStableImageLayer() {
  const layer = state.imageLayer;

  if (!layer || !layer.source || layer.stableRadius <= 0) {
    return;
  }

  const { source, rect, centerX, centerY, stableRadius } = layer;
  const overlapRadius = stableRadius + (state.config?.sampleGap || CONFIG.sampleGap) * 2;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, overlapRadius, 0, TWO_PI);
  ctx.clip();
  ctx.drawImage(source, rect.offsetX, rect.offsetY, rect.width, rect.height);
  ctx.restore();
}

function drawParticleBodies() {
  ctx.globalCompositeOperation = "source-over";

  for (const particle of state.particles) {
    if (particle.edgeWeight <= 0) {
      continue;
    }

    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TWO_PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawStableHighlightParticles(config) {
  ctx.globalCompositeOperation = "source-over";

  for (const particle of state.particles) {
    if (particle.edgeWeight <= 0) {
      continue;
    }

    const highlight = getStableHighlightPaint(particle, config);

    if (!highlight) {
      continue;
    }

    ctx.globalAlpha = highlight.alpha;
    ctx.fillStyle = highlight.color;
    ctx.beginPath();
    ctx.arc(
      particle.x + highlight.offsetX,
      particle.y + highlight.offsetY,
      highlight.radius,
      0,
      TWO_PI,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function getEdgeShellParticleRenderState(shellParticle, edgeShellFields, config, amount) {
  const source = state.particles[shellParticle.sourceIndex];

  if (!source) {
    return null;
  }

  const edgeFactor = smoothstep(config.edgeShellInnerThreshold, 1, source.edgeWeight);

  if (edgeFactor <= 0) {
    return null;
  }

  const patchInfluence = getEdgeShellPatchInfluence(shellParticle, edgeShellFields, config);
  const tangentX = -source.outwardY;
  const tangentY = source.outwardX;
  const time = state.time;
  const rimBias = shellParticle.rimBias || 0;
  const waveNoise =
    fbm(shellParticle.seed * 8.7, time * 0.012, shellParticle.normalizedRadius * 4.9) * 2 - 1;
  const breath =
    Math.sin(time * 0.018 + shellParticle.motionSeed * TWO_PI) *
    (1.8 + edgeFactor * 3.6 + rimBias * 2.1);
  const waveLift =
    (Math.sin(time * 0.021 + shellParticle.seed * 11.3) + waveNoise * 0.72) *
    config.edgeShellWaveStrength *
    edgeFactor *
    (0.18 + patchInfluence * 0.34 + rimBias * 0.2);
  const tangentDrift =
    Math.sin(time * 0.014 + shellParticle.seed * TWO_PI) *
    (2.2 + patchInfluence * 5.2 + rimBias * 1.6);
  const slowReturn =
    Math.sin(time * 0.007 + shellParticle.alphaSeed * TWO_PI) *
    (0.9 + edgeFactor * 1.8);
  const outwardOffset =
    shellParticle.outwardOffset +
    breath +
    slowReturn +
    waveLift +
    patchInfluence *
      (5.2 + edgeFactor * 8.8 + rimBias * 5.4 + config.edgeShellPatchLift);
  const tangentOffset = shellParticle.tangentOffset + tangentDrift;
  const alpha =
    shellParticle.alpha *
    amount *
    (0.64 + patchInfluence * 0.96 + rimBias * 0.22) *
    (0.82 + shellParticle.alphaSeed * 0.24);

  if (alpha <= 0.01) {
    return null;
  }

  return {
    x: source.x + source.outwardX * outwardOffset + tangentX * tangentOffset,
    y: source.y + source.outwardY * outwardOffset + tangentY * tangentOffset,
    radius:
      shellParticle.radius *
      (0.92 + patchInfluence * 0.42 + rimBias * 0.12) *
      (0.95 + Math.sin(time * 0.011 + shellParticle.seed * 9.2) * 0.05),
    alpha,
    patchInfluence,
    color: shellParticle.color,
  };
}

function drawEdgeShellGlowLayer(config, edgeShellFields) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const quality = getRuntimeQuality();

  if (
    amount <= 0 ||
    quality < 0.56 ||
    state.edgeShellParticles.length === 0 ||
    config.edgeShellGlowAlpha <= 0
  ) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(2, config.edgeShellGlowBlur * quality)}px)`;

  for (const shellParticle of state.edgeShellParticles) {
    if (shellParticle.alphaSeed > lerp(0.32, 1, quality)) {
      continue;
    }

    const renderState = getEdgeShellParticleRenderState(
      shellParticle,
      edgeShellFields,
      config,
      amount,
    );

    if (!renderState) {
      continue;
    }

    const glowAlpha =
      renderState.alpha *
      config.edgeShellGlowAlpha *
      (0.56 + renderState.patchInfluence * 0.5);

    if (glowAlpha <= 0.01) {
      continue;
    }

    ctx.globalAlpha = clamp(glowAlpha, 0, 0.42);
    ctx.fillStyle = renderState.color;
    ctx.beginPath();
    ctx.arc(
      renderState.x,
      renderState.y,
      Math.max(1.2, renderState.radius * (3.2 + renderState.patchInfluence * 1.4)),
      0,
      TWO_PI,
    );
    ctx.fill();
  }

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
}

function drawEdgeShellParticles(config, edgeShellFields) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const quality = getRuntimeQuality();

  if (amount <= 0 || state.edgeShellParticles.length === 0) {
    return;
  }

  ctx.globalCompositeOperation = "source-over";

  for (const shellParticle of state.edgeShellParticles) {
    if (shellParticle.alphaSeed > lerp(0.58, 1, quality)) {
      continue;
    }

    const renderState = getEdgeShellParticleRenderState(
      shellParticle,
      edgeShellFields,
      config,
      amount,
    );

    if (!renderState) {
      continue;
    }

    ctx.globalAlpha = clamp(renderState.alpha, 0, 0.92);
    ctx.fillStyle = renderState.color;
    ctx.beginPath();
    ctx.arc(renderState.x, renderState.y, Math.max(0.2, renderState.radius), 0, TWO_PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawWhiteAccentParticles(config, edgeVeilFields) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const quality = getRuntimeQuality();

  if (amount <= 0) {
    return;
  }

  ctx.globalCompositeOperation = "source-over";

  for (const particle of state.particles) {
    const edgeFactor = smoothstep(0.26, 1, particle.edgeWeight);

    if (edgeFactor <= 0) {
      continue;
    }

    const darkWeight = 1 - smoothstep(0.16, 0.74, particle.luminance);
    const selectionRate = clamp(
      config.edgeWhiteAccentRate * edgeFactor * (0.72 + darkWeight * 0.62) * lerp(0.55, 1, quality),
      0,
      0.72,
    );

    if (particle.whiteSeed > selectionRate) {
      continue;
    }

    const veilInfluence = getEdgeVeilInfluence(particle, edgeVeilFields, config);
    const visibility =
      0.42 +
      darkWeight * config.edgeWhiteDarkBoost +
      veilInfluence * config.edgeWhiteVeilBoost;
    const alpha =
      particle.alpha *
      config.edgeWhiteAlpha *
      amount *
      edgeFactor *
      visibility *
      (0.72 + particle.whiteAlphaSeed * 0.46);

    if (alpha <= 0.018) {
      continue;
    }

    const tangentX = -particle.outwardY;
    const tangentY = particle.outwardX;
    const sideOffset = (particle.whiteOffsetSeed * 2 - 1) * particle.radius * 1.25;
    const outwardOffset =
      config.edgeWhiteOutwardOffset *
      edgeFactor *
      (0.45 + veilInfluence * 0.72 + particle.whiteAlphaSeed * 0.2);
    const x = particle.x + particle.outwardX * outwardOffset + tangentX * sideOffset;
    const y = particle.y + particle.outwardY * outwardOffset + tangentY * sideOffset;
    const radius = Math.max(
      0.34,
      particle.radius *
        config.edgeWhiteRadiusScale *
        (0.84 + particle.whiteAlphaSeed * 0.28),
    );
    const tint = particle.whiteAlphaSeed;
    const whiteR = lerp(238, 255, tint);
    const whiteG = lerp(240, 255, tint);
    const whiteB = lerp(232, 248, tint);

    ctx.globalAlpha = clamp(alpha, 0, 0.86);
    ctx.fillStyle = rgb(whiteR, whiteG, whiteB);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawEdgeStreamParticles(config, edgeVeilFields) {
  const amount = clamp(config.edgeGatherStrength / 10, 0, 1);
  const quality = getRuntimeQuality();

  if (amount <= 0 || quality < 0.54) {
    return;
  }

  ctx.globalCompositeOperation = "source-over";

  for (const particle of state.particles) {
    const edgeFactor = smoothstep(0.32, 1, particle.edgeWeight);

    if (edgeFactor <= 0) {
      continue;
    }

    const darkWeight = 1 - smoothstep(0.16, 0.74, particle.luminance);
    const veilInfluence = getEdgeVeilInfluence(particle, edgeVeilFields, config);
    const selectionRate = clamp(
      config.edgeStreamRate *
        edgeFactor *
        (0.62 + darkWeight * 0.38 + veilInfluence * 0.55) *
        lerp(0.5, 1, quality),
      0,
      0.74,
    );

    if (particle.streamSeed > selectionRate) {
      continue;
    }

    const direction = getEdgeStreamDirection(particle, edgeVeilFields, config);
    const visibility =
      0.38 +
      direction.strength * 0.44 +
      darkWeight * config.edgeStreamDarkBoost +
      veilInfluence * config.edgeStreamVeilBoost;
    const baseAlpha =
      particle.alpha *
      config.edgeStreamAlpha *
      amount *
      edgeFactor *
      visibility *
      (0.7 + particle.streamAlphaSeed * 0.5);

    if (baseAlpha <= 0.015) {
      continue;
    }

    const tangentX = -direction.y;
    const tangentY = direction.x;
    const sideJitter = (particle.streamOffsetSeed * 2 - 1) * particle.radius * 0.72;
    const spacing =
      config.edgeStreamSpacing *
      (0.78 + particle.streamAlphaSeed * 0.42 + veilInfluence * 0.28);
    const segmentCount = Math.max(1, Math.round(config.edgeStreamSegments));
    const tint = particle.streamAlphaSeed;
    const whiteR = lerp(232, 255, tint);
    const whiteG = lerp(236, 255, tint);
    const whiteB = lerp(228, 250, tint);

    ctx.fillStyle = rgb(whiteR, whiteG, whiteB);

    for (let i = 1; i <= segmentCount; i += 1) {
      const segmentT = i / segmentCount;
      const alpha = baseAlpha * Math.pow(1 - segmentT * 0.72, 1.15);

      if (alpha <= 0.01) {
        continue;
      }

      const x =
        particle.x -
        direction.x * spacing * i +
        tangentX * sideJitter * (1 + segmentT * 0.55);
      const y =
        particle.y -
        direction.y * spacing * i +
        tangentY * sideJitter * (1 + segmentT * 0.55);
      const radius = Math.max(
        0.22,
        particle.radius *
          config.edgeStreamRadiusScale *
          (1 - segmentT * 0.36) *
          (0.84 + particle.streamAlphaSeed * 0.22),
      );

      ctx.globalAlpha = clamp(alpha, 0, 0.64);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TWO_PI);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function drawParticles(timestamp = performance.now()) {
  state.animationId = requestAnimationFrame(drawParticles);

  const frameTime = timestamp - state.lastFrame || 16.67;
  const delta = Math.min(33.34, frameTime);
  state.lastFrame = timestamp;
  state.time += delta / 16.67;
  updatePerformanceQuality(frameTime);

  const config = state.config || readConfig();
  const time = state.time;
  const globalFlowX =
    (fbm(time * config.globalFlowSpeed, 13.7, 5.3) * 2 - 1) * config.globalMoveStrength;
  const globalFlowY =
    (fbm(17.1, time * config.globalFlowSpeed, 9.8) * 2 - 1) * config.globalMoveStrength;
  const edgeGatherFields = createEdgeGatherFields(config, time);
  const edgeVeilFields = createEdgeVeilFields(config, time);
  const edgeShellFields = createEdgeShellPatchFields(config, time);

  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, state.width, state.height);

  for (const particle of state.particles) {
    if (particle.edgeWeight <= 0) {
      particle.x = particle.baseX;
      particle.y = particle.baseY;
      particle.vx = 0;
      particle.vy = 0;
      continue;
    }

    updateParticle(particle, config, globalFlowX, globalFlowY, edgeGatherFields, edgeVeilFields, delta);
  }

  drawStableImageLayer();
  drawGlowLayer(config);
  drawParticleBodies();
  drawStableHighlightParticles(config);
  drawEdgeShellGlowLayer(config, edgeShellFields);
  drawEdgeShellParticles(config, edgeShellFields);
  drawWhiteAccentParticles(config, edgeVeilFields);
  drawEdgeStreamParticles(config, edgeVeilFields);
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.currentSource = image;
    regenerateParticles();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

function bindEvents() {
  elements.stableZoneRatio.addEventListener("input", () => {
    updateLabels();
    scheduleRegenerate();
  });

  elements.transitionRatio.addEventListener("input", () => {
    updateLabels();
    scheduleRegenerate();
  });

  elements.particleSize.addEventListener("input", () => {
    updateLabels();
    scheduleRegenerate();
  });

  elements.overallBrightness.addEventListener("input", () => {
    updateLabels();
    state.config = readConfig();
    applyOverallBrightness(state.config);
  });

  elements.glowIntensity.addEventListener("input", () => {
    updateLabels();
    state.config = readConfig();
  });

  elements.edgeGatherStrength.addEventListener("input", () => {
    updateLabels();
    state.config = readConfig();
  });

  elements.imageInput.addEventListener("change", (event) => {
    loadImageFile(event.target.files?.[0]);
  });

  elements.regenerateButton.addEventListener("click", regenerateParticles);

  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => {
      resizeCanvas();
      regenerateParticles();
    }, 160);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(state.animationId);
      state.animationId = 0;
      return;
    }

    if (!state.animationId) {
      state.lastFrame = performance.now();
      state.animationId = requestAnimationFrame(drawParticles);
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function init() {
  registerServiceWorker();
  resizeCanvas();
  updateLabels();
  applyOverallBrightness(readConfig());
  bindEvents();
  state.currentSource = createDefaultSource();
  regenerateParticles();
  state.animationId = requestAnimationFrame(drawParticles);
}

init();
