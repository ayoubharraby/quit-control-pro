// ----- Core local state -----
const state = {
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  activeDay: 1,
  logs: [],
  smoked: {},
  skipped: {},
  plan: [],
  config: null,
  user: null,      // Firebase user
  cloudLoaded: false
};

const $ = (id) => document.getElementById(id);
const els = {
  setupModal: $("setupModal"),
  openSetup: $("openSetup"),
  closeSetup: $("closeSetup"),
  themeToggle: $("themeToggle"),
  baseline: $("baseline"),
  dayOneCap: $("dayOneCap"),
  firstTime: $("firstTime"),
  totalDays: $("totalDays"),
  wake: $("wake"),
  sleep: $("sleep"),
  weed: $("weed"),
  pattern: $("pattern"),
  customWrap: $("customWrap"),
  customPattern: $("customPattern"),
  generatePlan: $("generatePlan"),
  loadDefault: $("loadDefault"),
  currentDayLabel: $("currentDayLabel"),
  capLabel: $("capLabel"),
  usedLabel: $("usedLabel"),
  remainingLabel: $("remainingLabel"),
  baselineStat: $("baselineStat"),
  dayOneStat: $("dayOneStat"),
  nextSlotStat: $("nextSlotStat"),
  quitDayStat: $("quitDayStat"),
  heroPill: $("heroPill"),
  countdownClock: $("countdownClock"),
  countdownText: $("countdownText"),
  progressBar: $("progressBar"),
  dayTabs: $("dayTabs"),
  slotList: $("slotList"),
  planList: $("planList"),
  markSmoked: $("markSmoked"),
  markSkipped: $("markSkipped"),
  markSmokedMobile: $("markSmokedMobile"),
  markSkippedMobile: $("markSkippedMobile"),
  actionHint: $("actionHint"),
  scheduleSummary: $("scheduleSummary"),
  craving: $("craving"),
  saveCraving: $("saveCraving"),
  fillCraving: $("fillCraving"),
  logList: $("logList"),
  authEmail: $("authEmail"),
  authPassword: $("authPassword"),
  btnSignUp: $("btnSignUp"),
  btnSignIn: $("btnSignIn"),
  btnSignOut: $("btnSignOut"),
  authStatus: $("authStatus"),
  authHint: $("authHint"),
};

const STORAGE_KEY = "quit-control-pro-state";

// ----- Firebase config (replace with your project) -----
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ----- Local persistence -----
function saveStateLocal() {
  const payload = {
    theme: state.theme,
    activeDay: state.activeDay,
    config: state.config,
    plan: state.plan,
    smoked: state.smoked,
    skipped: state.skipped,
    logs: state.logs,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadStateLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.plan)) return false;
    state.theme = payload.theme || state.theme;
    state.activeDay = payload.activeDay || 1;
    state.config = payload.config || null;
    state.plan = payload.plan || [];
    state.smoked = payload.smoked || {};
    state.skipped = payload.skipped || {};
    state.logs = payload.logs || [];
    return true;
  } catch (e) {
    return false;
  }
}

function hydrateInputsFromConfig() {
  if (!state.config) return;
  els.baseline.value = state.config.baseline ?? 20;
  els.dayOneCap.value = state.config.dayOneCap ?? 6;
  els.weed.value = state.config.weed ?? "0";
  els.firstTime.value = state.config.firstTime ?? "11:42";
  els.wake.value = state.config.wake ?? "08:00";
  els.sleep.value = state.config.sleep ?? "21:30";
  els.totalDays.value = state.config.totalDays ?? 10;
  els.pattern.value = state.config.pattern ?? "6,6,6,4,4,3,3,2,1,0";
  els.customPattern.value = state.config.customPattern ?? "";
  els.customWrap.hidden = els.pattern.value !== "custom";
}

// ----- Theme -----
function setTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  saveStateLocal();
}

els.themeToggle.onclick = () =>
  setTheme(state.theme === "dark" ? "light" : "dark");

els.openSetup.onclick = () => els.setupModal.classList.add("open");
els.closeSetup.onclick = () => els.setupModal.classList.remove("open");
els.pattern.onchange = () => {
  els.customWrap.hidden = els.pattern.value !== "custom";
};
els.loadDefault.onclick = () => {
  els.baseline.value = 20;
  els.dayOneCap.value = 6;
  els.firstTime.value = "11:42";
  els.totalDays.value = 10;
  els.wake.value = "08:00";
  els.sleep.value = "21:30";
  els.weed.value = "0";
  els.pattern.value = "6,6,6,4,4,3,3,2,1,0";
  els.customPattern.value = "";
  els.customWrap.hidden = true;
};

// ----- Time helpers -----
function parseMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function fmtMinutes(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ----- Pattern & plan -----
function makePattern() {
  const total = Number(els.totalDays.value) || 10;
  let caps = (
    els.pattern.value === "custom"
      ? els.customPattern.value
      : els.pattern.value
  )
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  if (!caps.length) caps = [6, 6, 6, 4, 4, 3, 3, 2, 1, 0];
  if (caps.length < total) {
    const last = caps[caps.length - 1] ?? 0;
    while (caps.length < total) caps.push(last);
  }
  return caps.slice(0, total);
}

function generatePlan() {
  const caps = makePattern();
  const wake = parseMinutes(els.wake.value);
  const sleep = parseMinutes(els.sleep.value);
  const first = parseMinutes(els.firstTime.value);
  const usableStart = Math.max(first, wake);
  const totalDays = Number(els.totalDays.value) || caps.length;

  state.config = {
    baseline: Number(els.baseline.value) || 20,
    dayOneCap: Number(els.dayOneCap.value) || 6,
    weed: els.weed.value,
    firstTime: els.firstTime.value || "11:42",
    wake: els.wake.value || "08:00",
    sleep: els.sleep.value || "21:30",
    totalDays,
    pattern: els.pattern.value,
    customPattern: els.customPattern.value || "",
  };

  state.plan = [];
  state.smoked = {};
  state.skipped = {};
  state.activeDay = 1;

  for (let day = 1; day <= totalDays; day++) {
    const cap = caps[day - 1] ?? 0;
    let start = day === 1 ? usableStart : wake;
    let slots = [];

    if (cap > 0) {
      if (cap === 1) {
        slots = [fmtMinutes(start)];
      } else {
        const span = Math.max(sleep - start, 0);
        const step = Math.floor(span / Math.max(cap - 1, 1));
        for (let i = 0; i < cap; i++) {
          slots.push(fmtMinutes(Math.min(start + step * i, sleep)));
        }
      }
    }

    const phase =
      cap === 0
        ? "Quit"
        : cap >= state.config.dayOneCap
        ? "Stabilize"
        : cap >= 4
        ? "Reduce"
        : cap >= 2
        ? "Stretch"
        : "Final";

    state.plan.push({ day, cap, phase, slots });
  }

  state.config.quitDay = `Day ${state.plan.length}`;
  els.setupModal.classList.remove("open");

  syncAll();
}

// ----- Accessors -----
function planFor(day) {
  return state.plan.find((p) => p.day === day);
}
function keyFor(day) {
  return `d${day}`;
}
function smoked(day) {
  return state.smoked[keyFor(day)] || [];
}
function skipped(day) {
  return state.skipped[keyFor(day)] || [];
}
function unresolved(day) {
  const p = planFor(day);
  if (!p) return [];
  return p.slots
    .map((time, index) => ({ time, index, mins: parseMinutes(time) }))
    .filter(
      (s) => !smoked(day).includes(s.index) && !skipped(day).includes(s.index)
    );
}

// ----- Rendering -----
function renderTabs() {
  els.dayTabs.innerHTML = "";
  state.plan.forEach((p) => {
    const b = document.createElement("button");
    b.className = `tab ${p.day === state.activeDay ? "active" : ""}`;
    b.textContent = `Day ${p.day}`;
    b.onclick = () => {
      state.activeDay = p.day;
      syncAll();
    };
    els.dayTabs.appendChild(b);
  });
}

function renderSlots() {
  const p = planFor(state.activeDay);
  els.slotList.innerHTML = "";
  if (!p) {
    els.slotList.innerHTML =
      '<div class="rule"><strong>No plan yet</strong><div class="muted">Complete setup to generate the schedule.</div></div>';
    return;
  }
  if (!p.slots.length) {
    els.slotList.innerHTML = `<div class="rule"><strong>Day ${
      p.day
    }</strong><div class="muted">Zero cigarettes. Protect the line.</div></div>`;
    return;
  }
  p.slots.forEach((time, index) => {
    const row = document.createElement("div");
    const done = smoked(p.day).includes(index);
    const skip = skipped(p.day).includes(index);
    row.className = `slot ${done ? "done" : ""} ${skip ? "skipped" : ""}`;
    row.innerHTML = `
      <div class="pill">#${index + 1}</div>
      <div>
        <strong>${time}</strong>
        <div class="tiny">${done ? "Used" : skip ? "Skipped, gone" : "Pending"}</div>
      </div>
      <div class="slot-status">${done ? "Used" : skip ? "Skipped" : "Pending"}</div>
    `;
    els.slotList.appendChild(row);
  });
}

function renderPlanMap() {
  els.planList.innerHTML = "";
  state.plan.forEach((p) => {
    const row = document.createElement("div");
    row.className = "rule";
    row.innerHTML = `
      <strong>Day ${p.day}</strong>
      <div class="muted">Cap ${p.cap}. ${p.phase}. ${
      p.slots.length ? p.slots.join(" · ") : "No cigarettes."
    }</div>
    `;
    els.planList.appendChild(row);
  });
}

function updateStats() {
  const p = planFor(state.activeDay);
  if (!p) return;

  const used = smoked(p.day).length;
  const remaining = Math.max(p.cap - used, 0);

  els.currentDayLabel.textContent = `Day ${p.day}`;
  els.capLabel.textContent = p.cap;
  els.usedLabel.textContent = used;
  els.remainingLabel.textContent = remaining;

  els.baselineStat.textContent = `${state.config?.baseline ?? 20}/day`;
  els.dayOneStat.textContent = state.plan[0]?.cap ?? 6;
  els.nextSlotStat.textContent = unresolved(p.day)[0]?.time ?? "None";
  els.quitDayStat.textContent = state.config?.quitDay ?? `Day ${state.plan.length || 10}`;
  els.heroPill.textContent =
    state.config?.weed === "1"
      ? "Weed still active: shut that front too"
      : "Weed locked at 0";

  els.scheduleSummary.textContent = `Day ${p.day}: ${p.cap} max, ${used} used, ${remaining} left`;

  const disable =
    !p.slots.length ||
    !unresolved(p.day).length ||
    p.cap === 0 ||
    used >= p.cap;

  [els.markSmoked, els.markSkipped, els.markSmokedMobile, els.markSkippedMobile].forEach(
    (b) => (b.disabled = disable)
  );
  els.actionHint.textContent = disable
    ? "No open slot to act on right now."
    : "One cigarette per slot. Skipped means gone.";
}

function updateCountdown() {
  const p = planFor(state.activeDay);
  if (!p) {
    els.countdownText.textContent = "Generate a plan first.";
    return;
  }
  if (p.cap === 0 || !p.slots.length) {
    els.countdownClock.textContent = "00:00:00";
    els.countdownText.textContent = "Quit day. No more cigarettes.";
    els.progressBar.style.width = "100%";
    return;
  }
  const next = unresolved(p.day)[0];
  if (!next) {
    els.countdownClock.textContent = "00:00:00";
    els.countdownText.textContent = "All slots resolved for this day.";
    els.progressBar.style.width = "100%";
    return;
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let diff = (next.mins - nowMin) * 60 - now.getSeconds();

  const resolved = [...smoked(p.day), ...skipped(p.day)].sort((a, b) => a - b);
  const prevIndex = resolved.length ? resolved[resolved.length - 1] : -1;
  const prevMin =
    prevIndex >= 0
      ? parseMinutes(p.slots[prevIndex])
      : parseMinutes(
          state.activeDay === 1
            ? state.config?.firstTime || "11:42"
            : state.config?.wake || "08:00"
        );

  const total = Math.max((next.mins - prevMin) * 60, 1);
  const elapsed = Math.min(Math.max(total - diff, 0), total);
  els.progressBar.style.width = `${(elapsed / total) * 100}%`;

  if (diff <= 0) {
    els.countdownClock.textContent = "00:00:00";
    els.countdownText.textContent = `Slot open now: ${next.time}`;
    return;
  }
  const h = String(Math.floor(diff / 3600)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const s = String(diff % 60).padStart(2, "0");
  els.countdownClock.textContent = `${h}:${m}:${s}`;
  els.countdownText.textContent = `Next allowed cigarette at ${next.time}`;
}

// ----- Cravings -----
els.fillCraving.onclick = () => {
  els.craving.value =
    "Coffee + stress + grief spike. Wanted to light early. Stayed inside the slot rule.";
  els.craving.focus();
};
els.saveCraving.onclick = () => {
  const text = els.craving.value.trim();
  if (!text) return;
  state.logs.push({ text, time: new Date().toLocaleString() });
  els.craving.value = "";
  syncAll();
};

function renderLogs() {
  els.logList.innerHTML = "";
  if (!state.logs.length) {
    els.logList.innerHTML =
      '<div class="entry"><strong>No cravings logged yet</strong><div class="muted">Log the wave instead of negotiating with it.</div></div>';
    return;
  }
  [...state.logs].reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `<strong>${item.text}</strong><time>${item.time}</time>`;
    els.logList.appendChild(row);
  });
}

// ----- Actions -----
function mark(type) {
  const p = planFor(state.activeDay);
  if (!p) return;
  const next = unresolved(p.day)[0];
  if (!next) return;

  const bucket = type === "smoked" ? state.smoked : state.skipped;
  const key = keyFor(p.day);
  bucket[key] = [...(bucket[key] || []), next.index];

  syncAll();
}
[els.markSmoked, els.markSmokedMobile].forEach(
  (b) => (b.onclick = () => mark("smoked"))
);
[els.markSkipped, els.markSkippedMobile].forEach(
  (b) => (b.onclick = () => mark("skipped"))
);

// ----- Firebase sync helpers -----
async function saveStateCloud() {
  if (!state.user) return;
  const docRef = db.collection("quitPlans").doc(state.user.uid);
  const payload = {
    theme: state.theme,
    activeDay: state.activeDay,
    config: state.config,
    plan: state.plan,
    smoked: state.smoked,
    skipped: state.skipped,
    logs: state.logs,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await docRef.set(payload, { merge: true });
  } catch (e) {
    // cloud save failure is non-fatal
  }
}

async function loadStateCloud() {
  if (!state.user) return false;
  const docRef = db.collection("quitPlans").doc(state.user.uid);
  try {
    const snap = await docRef.get();
    if (!snap.exists) return false;
    const payload = snap.data();
    if (!Array.isArray(payload.plan)) return false;

    state.theme = payload.theme || state.theme;
    state.activeDay = payload.activeDay || 1;
    state.config = payload.config || null;
    state.plan = payload.plan || [];
    state.smoked = payload.smoked || {};
    state.skipped = payload.skipped || {};
    state.logs = payload.logs || [];
    state.cloudLoaded = true;
    return true;
  } catch (e) {
    return false;
  }
}

function syncAll() {
  saveStateLocal();
  render();
  if (state.user) {
    saveStateCloud();
  }
}

// ----- Auth UI -----
function updateAuthUI() {
  if (state.user) {
    els.authStatus.textContent = `Signed in as ${state.user.email}`;
    els.btnSignOut.style.display = "block";
    els.authHint.textContent = "Progress is synced to your private cloud profile.";
  } else {
    els.authStatus.textContent = "Offline only";
    els.btnSignOut.style.display = "none";
    els.authHint.textContent =
      "Not required; the app works offline. Sign in only if you want to sync progress across devices.";
  }
}

els.btnSignUp.onclick = async () => {
  const email = els.authEmail.value.trim();
  const pass = els.authPassword.value;
  if (!email || !pass) return;
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    state.user = cred.user;
    updateAuthUI();
    await saveStateCloud();
  } catch (e) {
    alert("Sign-up failed: " + e.message);
  }
};

els.btnSignIn.onclick = async () => {
  const email = els.authEmail.value.trim();
  const pass = els.authPassword.value;
  if (!email || !pass) return;
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    state.user = cred.user;
    updateAuthUI();
    // Try cloud first; if no cloud data, keep local
    const loaded = await loadStateCloud();
    if (!loaded) {
      saveStateCloud();
    }
    hydrateInputsFromConfig();
    setTheme(state.theme || "light");
    render();
  } catch (e) {
    alert("Sign-in failed: " + e.message);
  }
};

els.btnSignOut.onclick = async () => {
  await auth.signOut();
  state.user = null;
  updateAuthUI();
};

// Observe auth state changes
auth.onAuthStateChanged(async (user) => {
  state.user = user || null;
  updateAuthUI();
  if (user && !state.cloudLoaded) {
    const loaded = await loadStateCloud();
    if (loaded) {
      hydrateInputsFromConfig();
      setTheme(state.theme || "light");
      render();
      return;
    }
    await saveStateCloud();
  }
});

// ----- Render root -----
function renderRoot() {
  renderTabs();
  renderSlots();
  renderPlanMap();
  updateStats();
  updateCountdown();
  renderLogs();
}

// ----- Startup -----
if (!loadStateLocal()) {
  setTheme(state.theme);
  generatePlan();
} else {
  hydrateInputsFromConfig();
  setTheme(state.theme || "light");
  renderRoot();
}

setInterval(updateCountdown, 1000);
