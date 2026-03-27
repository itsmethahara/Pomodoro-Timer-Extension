// popup.js — Pomodoro Timer Logic

const CIRCUMFERENCE = 2 * Math.PI * 68; // ≈ 427

// DOM refs
const timeDisplay  = document.getElementById('timeDisplay');
const sessionLabel = document.getElementById('sessionLabel');
const startBtn     = document.getElementById('startBtn');
const resetBtn     = document.getElementById('resetBtn');
const skipBtn      = document.getElementById('skipBtn');
const ringEl       = document.getElementById('ring');
const tabs         = document.querySelectorAll('.tab');
const dots         = document.querySelectorAll('.dot');

// Labels per mode
const modeConfig = {
  focus: { label: 'Focus Time',    minutes: 25 },
  short: { label: 'Short Break',   minutes: 5  },
  long:  { label: 'Long Break',    minutes: 15 }
};

let state = {
  mode:        'focus',
  totalSecs:   25 * 60,
  remaining:   25 * 60,
  running:     false,
  sessions:    0,
  finished:    false
};

let ticker = null; // local interval while popup is open

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  chrome.storage.local.get(
    ['mode','remaining','running','sessions','startedAt','totalSecs','finished'],
    (saved) => {
      if (saved.mode)       state.mode      = saved.mode;
      if (saved.sessions)   state.sessions  = saved.sessions;
      if (saved.totalSecs)  state.totalSecs = saved.totalSecs;
      if (saved.finished)   state.finished  = saved.finished;

      // If timer was running, calculate elapsed time
      if (saved.running && saved.startedAt) {
        const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
        state.remaining = Math.max(0, (saved.remaining || state.totalSecs) - elapsed);
        if (state.remaining <= 0) {
          state.running  = false;
          state.finished = true;
          state.remaining = 0;
        } else {
          state.running = true;
        }
      } else {
        state.remaining = saved.remaining ?? state.totalSecs;
        state.running   = false;
      }

      // Sync active tab
      tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === state.mode));

      render();

      if (state.running) startTicker();
    }
  );
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const mins = Math.floor(state.remaining / 60);
  const secs = state.remaining % 60;
  timeDisplay.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  sessionLabel.textContent = modeConfig[state.mode].label;

  // Ring progress
  const progress  = state.remaining / state.totalSecs;
  const offset    = CIRCUMFERENCE * (1 - progress);
  ringEl.style.strokeDasharray  = CIRCUMFERENCE;
  ringEl.style.strokeDashoffset = offset;

  // Colour the ring during break modes
  if (state.mode === 'short' || state.mode === 'long') {
    ringEl.style.stroke  = '#7ec8e3';
    ringEl.style.filter  = 'drop-shadow(0 0 6px rgba(126, 200, 227, 0.5))';
  } else {
    ringEl.style.stroke  = '#ff6b6b';
    ringEl.style.filter  = 'drop-shadow(0 0 6px rgba(255, 107, 107, 0.5))';
  }

  // Button label
  if (state.finished) {
    startBtn.textContent = 'Done ✓';
    startBtn.classList.add('paused');
    timeDisplay.classList.add('done');
  } else if (state.running) {
    startBtn.textContent = 'Pause';
    startBtn.classList.remove('paused');
    timeDisplay.classList.remove('done');
  } else {
    startBtn.textContent = state.remaining < state.totalSecs ? 'Resume' : 'Start';
    startBtn.classList.add('paused');
    timeDisplay.classList.remove('done');
  }

  // Session dots
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < state.sessions % 4));
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(() => {
    if (!state.running) return clearInterval(ticker);
    state.remaining--;
    if (state.remaining <= 0) {
      state.remaining = 0;
      state.running   = false;
      state.finished  = true;
      if (state.mode === 'focus') state.sessions++;
      clearInterval(ticker);
      persist();
    }
    render();
  }, 1000);
}

// ── Persist to storage ────────────────────────────────────────────────────────
function persist() {
  chrome.storage.local.set({
    mode:      state.mode,
    remaining: state.remaining,
    running:   state.running,
    sessions:  state.sessions,
    totalSecs: state.totalSecs,
    finished:  state.finished,
    startedAt: state.running ? Date.now() : null
  });
}

// ── Alarm helpers ─────────────────────────────────────────────────────────────
function setAlarm() {
  chrome.alarms.clear('pomodoroEnd', () => {
    chrome.alarms.create('pomodoroEnd', {
      delayInMinutes: state.remaining / 60
    });
  });
}
function clearAlarm() {
  chrome.alarms.clear('pomodoroEnd');
}

// ── Button handlers ───────────────────────────────────────────────────────────
startBtn.addEventListener('click', () => {
  if (state.finished) return; // no-op if done

  if (state.running) {
    // Pause
    state.running = false;
    clearInterval(ticker);
    clearAlarm();
  } else {
    // Start / Resume
    state.running  = true;
    state.finished = false;
    startTicker();
    setAlarm();
  }
  persist();
  render();
});

resetBtn.addEventListener('click', () => {
  clearInterval(ticker);
  clearAlarm();
  state.running   = false;
  state.finished  = false;
  state.remaining = state.totalSecs;
  persist();
  render();
});

skipBtn.addEventListener('click', () => {
  clearInterval(ticker);
  clearAlarm();
  if (state.mode === 'focus') state.sessions++;
  state.running   = false;
  state.finished  = false;
  state.remaining = state.totalSecs;
  persist();
  render();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    clearInterval(ticker);
    clearAlarm();
    state.mode      = tab.dataset.mode;
    state.totalSecs = Number(tab.dataset.minutes) * 60;
    state.remaining = state.totalSecs;
    state.running   = false;
    state.finished  = false;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    persist();
    render();
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
