import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLJ7MVQGWHY9ooc2sRW0ivjomrqxVMG04",
  authDomain: "cig-quit.firebaseapp.com",
  projectId: "cig-quit",
  storageBucket: "cig-quit.firebasestorage.app",
  messagingSenderId: "733695667533",
  appId: "1:733695667533:web:8d14eaea212a4559311b04",
  measurementId: "G-3C36NB645K",
};

const fbApp = initializeApp(firebaseConfig);
try {
  analyticsIsSupported().then((ok) => { if (ok) getAnalytics(fbApp); });
} catch (e) {}

const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const state = {
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  activeDay: 1,
  logs: [],
  smoked: {},
  skipped: {},
  plan: [],
  config: null,
  user: null,
  mode: "unauth", // unauth | offline | user
};

const $ = (id) => document.getElementById(id);
const els = {
  authGate: $("authGate"),
  gateTabSignIn: $("gateTabSignIn"),
  gateTabSignUp: $("gateTabSignUp"),
  gateEmail: $("gateEmail"),
  gatePassword: $("gatePassword"),
  gateError: $("gateError"),
  gateSubmitBtn: $("gateSubmitBtn"),
  gateContinueBtn: $("gateContinueBtn"),
  appRoot: $("appRoot"),
  sidebar: $("sidebar"),
  sidebarOverlay: $("sidebarOverlay"),
  menuToggle: $("menuToggle"),
  resetBtn: $("resetBtn"),
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
  sidebarAuthForm: $("sidebarAuthForm"),
};

const STORAGE_KEY = "quit-control-pro-state";
const OFFLINE_FLAG = "qcp-offline-mode";

function saveStateLocal() {
  if (state.mode === "user") {
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
}

function getLocalPayloadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.plan)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function applyPayload(payload) {
  state.activeDay = payload.activeDay || 1;
  state.config = payload.config || null;
  state.plan = payload.plan || [];
  state.smoked = payload.smoked || {};
  state.skipped = payload.skipped || {};
  state.logs = payload.logs || [];
  if (payload.theme) state.theme = payload.theme;
}

function hydrateInputsFromConfig() {
  if (!state.config) return;
  els.baseline.value = state.config.baseline ?? 0;
  els.dayOneCap.value = state.config.dayOneCap ?? 0;
  els.weed.value = state.config.weed ?? "0";
  els.firstTime.value = state.config.firstTime ?? "08:00";
  els.wake.value = state.config.wake ?? "08:00";
  els.sleep.value = state.config.sleep ?? "21:30";
  els.totalDays.value = state.config.totalDays ?? 1;
  els.pattern.value = state.config.pattern ?? "0";
  els.customPattern.value = state.config.customPattern ?? "";
  els.customWrap.hidden = els.pattern.value !== "custom";
}

function setTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  saveStateLocal();
}
els.themeToggle.onclick = () => setTheme(state.theme === "dark" ? "light" : "dark");

els.openSetup.onclick = () => els.setupModal.classList.add("open");
els.closeSetup.onclick = () => els.setupModal.classList.remove("open");
els.pattern.onchange = () => { els.customWrap.hidden = els.pattern.value !== "custom"; };
els.loadDefault.onclick = () => {
  els.baseline.value = 0;
  els.dayOneCap.value = 0;
  els.firstTime.value = "08:00";
  els.totalDays.value = 1;
  els.wake.value = "08:00";
  els.sleep.value = "21:30";
  els.weed.value = "0";
  els.pattern.value = "0";
  els.customPattern.value = "";
  els.customWrap.hidden = true;
};

function parseMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function fmtMinutes(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function makePattern() {
  const total = Number(els.totalDays.value) || 1;
  let caps;
  if (els.pattern.value === "0") {
    caps = new Array(total).fill(0);
  } else {
    caps = (els.pattern.value === "custom" ? els.customPattern.value : els.pattern.value)
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    if (!caps.length) caps = [0];
    if (caps.length < total) {
      const last = caps[caps.length - 1] ?? 0;
      while (caps.length < total) caps.push(last);
    }
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
    baseline: Number(els.baseline.value) || 0,
    dayOneCap: Number(els.dayOneCap.value) || 0,
    weed: els.weed.value,
    firstTime: els.firstTime.value || "08:00",
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
      cap === 0 ? "Quit" :
      cap >= state.config.dayOneCap ? "Stabilize" :
      cap >= 4 ? "Reduce" :
      cap >= 2 ? "Stretch" : "Final";

    state.plan.push({ day, cap, phase, slots });
  }

  state.config.quitDay = state.plan.length ? `Day ${state.plan.length}` : "—";
  els.setupModal.classList.remove("open");
  syncAll();
}
els.generatePlan.onclick = generatePlan;

function planFor(day) { return state.plan.find((p) => p.day === day); }
function keyFor(day) { return `d${day}`; }
function smoked(day) { return state.smoked[keyFor(day)] || []; }
function skipped(day) { return state.skipped[keyFor(day)] || []; }
function unresolved(day) {
  const p = planFor(day);
  if (!p) return [];
  return p.slots
    .map((time, index) => ({ time, index, mins: parseMinutes(time) }))
    .filter((s) => !smoked(day).includes(s.index) && !skipped(day).includes(s.index));
}

function renderTabs() {
  els.dayTabs.innerHTML = "";
  state.plan.forEach((p) => {
    const b = document.createElement("button");
    b.className = `tab ${p.day === state.activeDay ? "active" : ""}`;
    b.textContent = `Day ${p.day}`;
    b.onclick = () => { state.activeDay = p.day; syncAll(); };
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
    els.slotList.innerHTML =
      `<div class="rule"><strong>Day ${p.day}</strong><div class="muted">Zero cigarettes. Protect the line.</div></div>`;
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
    row.innerHTML =
      `<strong>Day ${p.day}</strong><div class="muted">Cap ${p.cap}. ${p.phase}. ${
        p.slots.length ? p.slots.join(" · ") : "No cigarettes."
      }</div>`;
    els.planList.appendChild(row);
  });
}

function updateStats() {
  const p = planFor(state.activeDay);
  if (!p) {
    els.currentDayLabel.textContent = "Day 1";
    els.capLabel.textContent = "0";
    els.usedLabel.textContent = "0";
    els.remainingLabel.textContent = "0";
    els.baselineStat.textContent = "0/day";
    els.dayOneStat.textContent = "0";
    els.nextSlotStat.textContent = "—";
    els.quitDayStat.textContent = "—";
    els.heroPill.textContent =
      state.mode === "offline"
        ? "Offline mode: everything starts at 0"
        : "Weed locked at 0";
    els.scheduleSummary.textContent = "No schedule yet. Open setup.";
    [els.markSmoked, els.markSkipped, els.markSmokedMobile, els.markSkippedMobile].forEach(
      (b) => (b.disabled = true)
    );
    return;
  }
  const used = smoked(p.day).length;
  const remaining = Math.max(p.cap - used, 0);
  els.currentDayLabel.textContent = `Day ${p.day}`;
  els.capLabel.textContent = p.cap;
  els.usedLabel.textContent = used;
  els.remainingLabel.textContent = remaining;
  els.baselineStat.textContent = `${state.config?.baseline ?? 0}/day`;
  els.dayOneStat.textContent = state.plan[0]?.cap ?? 0;
  els.nextSlotStat.textContent = unresolved(p.day)[0]?.time ?? "None";
  els.quitDayStat.textContent = state.config?.quitDay ?? "—";
  els.heroPill.textContent =
    state.config?.weed === "1"
      ? "Weed still active: shut that front too"
      : "Weed locked at 0";
  els.scheduleSummary.textContent =
    `Day ${p.day}: ${p.cap} max, ${used} used, ${remaining} left`;
  const disable =
    !p.slots.length || !unresolved(p.day).length || p.cap === 0 || used >= p.cap;
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
    els.countdownClock.textContent = "00:00:00";
    els.progressBar.style.width = "0%";
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
            ? state.config?.firstTime || "08:00"
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
[els.markSmoked, els.markSmokedMobile].forEach((b) => (b.onclick = () => mark("smoked")));
[els.markSkipped, els.markSkippedMobile].forEach((b) => (b.onclick = () => mark("skipped")));

function renderRoot() {
  renderTabs();
  renderSlots();
  renderPlanMap();
  updateStats();
  updateCountdown();
  renderLogs();
}

function syncAll() {
  if (state.mode === "user") saveStateLocal();
  renderRoot();
  if (state.mode === "user" && state.user) saveStateCloud();
}

async function saveStateCloud() {
  if (!state.user) return;
  const ref = doc(db, "quitPlans", state.user.uid);
  const payload = {
    theme: state.theme,
    activeDay: state.activeDay,
    config: state.config,
    plan: state.plan,
    smoked: state.smoked,
    skipped: state.skipped,
    logs: state.logs,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload, { merge: true });
  } catch (e) {}
}

async function getCloudPayloadRaw(uid) {
  try {
    const snap = await getDoc(doc(db, "quitPlans", uid));
    if (!snap.exists()) return null;
    const payload = snap.data();
    if (!Array.isArray(payload.plan)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/* ===== Auth UI & gate ===== */
function updateAuthUI() {
  if (state.mode === "user" && state.user) {
    els.authStatus.textContent = `Signed in as ${state.user.email}`;
    els.sidebarAuthForm.style.display = "none";
    els.btnSignOut.style.display = "block";
    els.authHint.textContent =
      "Progress is synced to your private cloud profile.";
  } else if (state.mode === "offline") {
    els.authStatus.textContent = "Offline mode";
    els.sidebarAuthForm.style.display = "block";
    els.btnSignOut.style.display = "none";
    els.authHint.textContent =
      "Offline profile: everything stays on this browser until you sign in.";
  } else {
    els.authStatus.textContent = "Offline only";
    els.sidebarAuthForm.style.display = "block";
    els.btnSignOut.style.display = "none";
    els.authHint.textContent =
      "Not required; the app works offline. Sign in only if you want cross‑device sync.";
  }
}

function showGateError(msg) {
  els.gateError.textContent = msg;
  els.gateError.hidden = false;
}
function hideGateError() {
  els.gateError.hidden = true;
}

let gateMode = "signin";
els.gateTabSignIn.onclick = () => {
  gateMode = "signin";
  els.gateTabSignIn.classList.add("active");
  els.gateTabSignUp.classList.remove("active");
  els.gateSubmitBtn.textContent = "Sign in";
  hideGateError();
};
els.gateTabSignUp.onclick = () => {
  gateMode = "signup";
  els.gateTabSignUp.classList.add("active");
  els.gateTabSignIn.classList.remove("active");
  els.gateSubmitBtn.textContent = "Create account";
  hideGateError();
};

async function doSignUp(email, pass) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  return cred.user;
}
async function doSignIn(email, pass) {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

els.gateSubmitBtn.onclick = async () => {
  hideGateError();
  const email = els.gateEmail.value.trim();
  const pass = els.gatePassword.value;
  if (!email || !pass) {
    showGateError("Enter both email and password.");
    return;
  }
  try {
    if (gateMode === "signup") {
      const user = await doSignUp(email, pass);
      await initializeNewUserState(user);
    } else {
      await doSignIn(email, pass);
    }
  } catch (e) {
    showGateError(e.message.replace("Firebase: ", ""));
  }
};

els.gateContinueBtn.onclick = () => {
  state.mode = "offline";
  try { localStorage.setItem(OFFLINE_FLAG, "1"); } catch (e) {}
  initOfflineZeroState();
  showApp();
};

els.btnSignUp.onclick = async () => {
  const email = els.authEmail.value.trim();
  const pass = els.authPassword.value;
  if (!email || !pass) return;
  try {
    const user = await doSignUp(email, pass);
    await initializeNewUserState(user);
  } catch (e) {
    alert("Sign-up failed: " + e.message);
  }
};
els.btnSignIn.onclick = async () => {
  const email = els.authEmail.value.trim();
  const pass = els.authPassword.value;
  if (!email || !pass) return;
  try {
    await doSignIn(email, pass);
  } catch (e) {
    alert("Sign-in failed: " + e.message);
  }
};
els.btnSignOut.onclick = async () => {
  await signOut(auth);
  state.user = null;
  state.mode = "offline";
  updateAuthUI();
};

function showGate() {
  els.authGate.style.display = "flex";
  els.appRoot.hidden = true;
}
function showApp() {
  els.authGate.style.display = "none";
  els.appRoot.hidden = false;
}

els.menuToggle.onclick = () => {
  els.sidebar.classList.add("open");
  els.sidebarOverlay.classList.add("open");
};
els.sidebarOverlay.onclick = () => {
  els.sidebar.classList.remove("open");
  els.sidebarOverlay.classList.remove("open");
};

els.resetBtn.onclick = async () => {
  const ok = confirm(
    "Reset all progress and setup? This clears the current profile only. If signed in, your cloud data for this account will also be wiped."
  );
  if (!ok) return;

  state.plan = [];
  state.smoked = {};
  state.skipped = {};
  state.logs = [];
  state.config = null;
  state.activeDay = 1;

  els.loadDefault.click();

  if (state.mode === "user" && state.user) {
    try {
      await deleteDoc(doc(db, "quitPlans", state.user.uid));
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  generatePlan();
};

function initOfflineZeroState() {
  state.mode = "offline";
  state.user = null;
  state.plan = [];
  state.smoked = {};
  state.skipped = {};
  state.logs = [];
  state.config = null;
  state.activeDay = 1;
  els.loadDefault.click();
  setTheme(state.theme);
  renderRoot();
  updateAuthUI();
}

async function initializeNewUserState(user) {
  state.user = user;
  state.mode = "user";
  // Fresh zero baseline with default taper pattern
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
  generatePlan();
  await saveStateCloud();
  updateAuthUI();
  showApp();
}

async function handleUserAuth(user) {
  state.user = user;
  state.mode = "user";
  const cloudPayload = await getCloudPayloadRaw(user.uid);
  if (cloudPayload) {
    applyPayload(cloudPayload);
  } else {
    const localPayload = getLocalPayloadRaw();
    if (localPayload) {
      applyPayload(localPayload);
      await saveStateCloud();
    } else {
      await initializeNewUserState(user);
      return;
    }
  }
  hydrateInputsFromConfig();
  setTheme(state.theme || "light");
  renderRoot();
  updateAuthUI();
  showApp();
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await handleUserAuth(user);
    return;
  }
  state.user = null;
  const offlineFlag = localStorage.getItem(OFFLINE_FLAG);
  if (offlineFlag === "1") {
    initOfflineZeroState();
    showApp();
  } else {
    state.mode = "unauth";
    updateAuthUI();
    showGate();
  }
});

setInterval(updateCountdown, 1000);
