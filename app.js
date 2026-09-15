const MODES = [
  {
    id: 'calm',
    name: '平缓呼吸',
    desc: '吸 4 · 呼 6｜日常放松',
    phases: [
      { label: '吸气', cue: 'in', secs: 4, to: 1 },
      { label: '呼气', cue: 'out', secs: 6, to: 0.45 },
    ],
  },
  {
    id: 'box',
    name: '方盒呼吸',
    desc: '4-4-4-4｜专注减压',
    phases: [
      { label: '吸气', cue: 'in', secs: 4, to: 1 },
      { label: '屏息', cue: 'hold', secs: 4, to: 1 },
      { label: '呼气', cue: 'out', secs: 4, to: 0.45 },
      { label: '屏息', cue: 'hold', secs: 4, to: 0.45 },
    ],
  },
  {
    id: '478',
    name: '4-7-8 呼吸',
    desc: '吸 4 · 屏 7 · 呼 8｜助眠',
    phases: [
      { label: '吸气', cue: 'in', secs: 4, to: 1 },
      { label: '屏息', cue: 'hold', secs: 7, to: 1 },
      { label: '呼气', cue: 'out', secs: 8, to: 0.45 },
    ],
  },
];

const DURATIONS = [1, 3, 5, 10];
const REST_SCALE = 0.6;
const PREFS_KEY = 'breath-prefs';

const prefs = loadPrefs();
const els = {
  scene: document.getElementById('scene'),
  gear: document.getElementById('gear'),
  circle: document.getElementById('circle'),
  phaseLabel: document.getElementById('phase-label'),
  phaseCount: document.getElementById('phase-count'),
  timer: document.getElementById('timer'),
  hint: document.getElementById('hint'),
  backdrop: document.getElementById('backdrop'),
  drawer: document.getElementById('drawer'),
  modeOptions: document.getElementById('mode-options'),
  durationOptions: document.getElementById('duration-options'),
  soundToggle: document.getElementById('sound-toggle'),
  vibrateToggle: document.getElementById('vibrate-toggle'),
  drawerDone: document.getElementById('drawer-done'),
  doneOverlay: document.getElementById('done-overlay'),
  doneDetail: document.getElementById('done-detail'),
  again: document.getElementById('again'),
};

const state = {
  status: 'idle',
  phaseIndex: 0,
  phaseFrom: REST_SCALE,
  currentScale: REST_SCALE,
  phaseStart: 0,
  pausedAt: 0,
  elapsedBase: 0,
  cycles: 0,
  rafId: 0,
  settleRafId: 0,
};

function loadPrefs() {
  const defaults = { mode: 'calm', mins: 3, sound: true, vibrate: true };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    if (!MODES.some((m) => m.id === saved.mode)) saved.mode = defaults.mode;
    if (!DURATIONS.includes(saved.mins)) saved.mins = defaults.mins;
    return saved;
  } catch {
    return defaults;
  }
}

function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function currentMode() {
  return MODES.find((m) => m.id === prefs.mode) || MODES[0];
}

const easeInOutSine = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p);

function fmtClock(secs) {
  secs = Math.max(0, Math.ceil(secs));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function setCircleScale(scale) {
  state.currentScale = scale;
  els.circle.style.transform = `scale(${scale})`;
}

function startSession() {
  cancelAnimationFrame(state.rafId);
  cancelAnimationFrame(state.settleRafId);
  els.doneOverlay.classList.remove('open');
  state.status = 'running';
  state.phaseIndex = 0;
  state.phaseFrom = REST_SCALE;
  state.elapsedBase = 0;
  state.cycles = 0;
  state.phaseStart = performance.now();
  els.hint.textContent = '轻触暂停';
  enterPhase();
  state.rafId = requestAnimationFrame(tick);
}

function tick(now) {
  if (state.status !== 'running') return;
  const phases = currentMode().phases;
  let phase = phases[state.phaseIndex];
  let t = (now - state.phaseStart) / 1000;

  while (t >= phase.secs) {
    state.elapsedBase += phase.secs;
    state.phaseStart += phase.secs * 1000;
    state.phaseFrom = phase.to;
    state.phaseIndex += 1;
    if (state.phaseIndex >= phases.length) {
      state.phaseIndex = 0;
      state.cycles += 1;
      if (state.elapsedBase >= prefs.mins * 60) {
        finishSession();
        return;
      }
    }
    phase = phases[state.phaseIndex];
    t = (now - state.phaseStart) / 1000;
    enterPhase();
  }

  const eased = easeInOutSine(t / phase.secs);
  setCircleScale(state.phaseFrom + (phase.to - state.phaseFrom) * eased);
  els.phaseCount.textContent = Math.ceil(phase.secs - t);
  els.timer.textContent = `剩余 ${fmtClock(prefs.mins * 60 - state.elapsedBase - t)}`;
  state.rafId = requestAnimationFrame(tick);
}

function enterPhase() {
  const phase = currentMode().phases[state.phaseIndex];
  els.phaseLabel.textContent = phase.label;
  playCue(phase.cue);
  vibrate(60);
}

function pauseSession() {
  if (state.status !== 'running') return;
  cancelAnimationFrame(state.rafId);
  state.status = 'paused';
  state.pausedAt = performance.now();
  els.phaseLabel.textContent = '已暂停';
  els.phaseCount.textContent = '';
  els.hint.textContent = '轻触继续';
}

function resumeSession() {
  if (state.status !== 'paused') return;
  state.phaseStart += performance.now() - state.pausedAt;
  state.status = 'running';
  els.hint.textContent = '轻触暂停';
  enterPhase();
  state.rafId = requestAnimationFrame(tick);
}

function finishSession() {
  state.status = 'done';
  els.phaseLabel.textContent = '';
  els.phaseCount.textContent = '';
  els.timer.textContent = '';
  els.hint.textContent = '';
  settleToRest();
  playDoneCue();
  vibrate([80, 120, 80]);
  const mins = Math.max(1, Math.round(state.elapsedBase / 60));
  els.doneDetail.textContent = `${state.cycles} 轮呼吸 · 约 ${mins} 分钟`;
  els.doneOverlay.classList.add('open');
}

function toIdle() {
  state.status = 'idle';
  els.doneOverlay.classList.remove('open');
  els.phaseLabel.textContent = '';
  els.phaseCount.textContent = '';
  els.timer.textContent = '';
  els.hint.textContent = '轻触任意处开始';
  settleToRest();
}

function settleToRest() {
  cancelAnimationFrame(state.settleRafId);
  const from = state.currentScale;
  const start = performance.now();
  const settle = (now) => {
    const p = Math.min((now - start) / 1200, 1);
    setCircleScale(from + (REST_SCALE - from) * easeInOutSine(p));
    if (p < 1) state.settleRafId = requestAnimationFrame(settle);
  };
  state.settleRafId = requestAnimationFrame(settle);
}

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCue(cue) {
  if (!prefs.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const glide = { in: [294, 392], out: [392, 294], hold: [349, 349] }[cue];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(glide[0], t);
  osc.frequency.linearRampToValueAtTime(glide[1], t + 0.9);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(cue === 'hold' ? 0.06 : 0.1, t + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 1.5);
}

function playDoneCue() {
  if (!prefs.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [freq, delay] of [[392, 0], [523, 0.25]]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.08, t + delay + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 1.3);
  }
}

function vibrate(pattern) {
  if (prefs.vibrate && 'vibrate' in navigator) navigator.vibrate(pattern);
}

function openDrawer() {
  if (state.status === 'running') pauseSession();
  els.backdrop.classList.add('open');
  els.drawer.classList.add('open');
}

function closeDrawer() {
  els.backdrop.classList.remove('open');
  els.drawer.classList.remove('open');
}

function restartIfPaused() {
  if (state.status === 'paused') toIdle();
}

function renderModeOptions() {
  els.modeOptions.innerHTML = '';
  for (const mode of MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mode-option' + (mode.id === prefs.mode ? ' selected' : '');
    btn.innerHTML = `<span class="name">${mode.name}</span><span class="desc">${mode.desc}</span>`;
    btn.addEventListener('click', () => {
      if (prefs.mode === mode.id) return;
      prefs.mode = mode.id;
      savePrefs();
      renderModeOptions();
      restartIfPaused();
    });
    els.modeOptions.appendChild(btn);
  }
}

function renderDurationOptions() {
  els.durationOptions.innerHTML = '';
  for (const mins of DURATIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${mins} 分钟`;
    btn.className = mins === prefs.mins ? 'selected' : '';
    btn.addEventListener('click', () => {
      if (prefs.mins === mins) return;
      prefs.mins = mins;
      savePrefs();
      renderDurationOptions();
      restartIfPaused();
    });
    els.durationOptions.appendChild(btn);
  }
}

els.scene.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#gear')) return;
  if (state.status === 'idle') startSession();
  else if (state.status === 'running') pauseSession();
  else if (state.status === 'paused') resumeSession();
});

els.gear.addEventListener('click', openDrawer);
els.backdrop.addEventListener('click', closeDrawer);
els.drawerDone.addEventListener('click', closeDrawer);

els.soundToggle.addEventListener('change', () => {
  prefs.sound = els.soundToggle.checked;
  savePrefs();
});
els.vibrateToggle.addEventListener('change', () => {
  prefs.vibrate = els.vibrateToggle.checked;
  savePrefs();
});

els.again.addEventListener('click', startSession);
els.doneOverlay.addEventListener('click', (e) => {
  if (e.target === els.doneOverlay) toIdle();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'running') pauseSession();
});

if (!('vibrate' in navigator)) {
  els.vibrateToggle.disabled = true;
  els.vibrateToggle.checked = false;
  document.getElementById('vibrate-label').textContent = '震动提示（当前设备不支持）';
}

renderModeOptions();
renderDurationOptions();
els.soundToggle.checked = prefs.sound;
els.vibrateToggle.checked = prefs.vibrate;
