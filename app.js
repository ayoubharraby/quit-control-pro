import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js";

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
const messaging = getMessaging(fbApp);

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
  notificationsEnabled: false,
  localTimers: [],
  fcmToken: null,
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
  notificationsBtn: $("notificationsBtn"),
  setupModal: $("setupModal"),
  openSetup: $("openSetup"),
  closeSetup: $("closeSetup"),
  themeToggle: $("themeToggle"),
  baseline: $("baseline"),
  target: $("target"),
  totalDays: $("totalDays"),
  modeSelect: $("mode"),
  curve: $("curve"),
  firstTime: $("firstTime"),
  wake: $("wake"),
  sleep: $("sleep"),
  weed: $("weed"),
  pattern: $("pattern"),
  customWrap: $("customWrap"),
  customPattern: $("customPattern"),
  generatePlan: $("generatePlan"),
  loadDefault: $("loadDefault"),
  setupHint: $("setupHint"),
  currentDayLabel: $("currentDayLabel"),
  capLabel: $("capLabel"),
  usedLabel: $("usedLabel"),
  remainingLabel: $("remainingLabel"),
  baselineStat: $("baselineStat"),
  targetStat: $("targetStat"),
  nextSlotStat: $("nextSlotStat"),
  quitDayStat: $("quitDayStat"),
  heroPill: $("heroPill"),
  countdownClock: $("countdownClock"),
  countdownText: $("countdownText"),
  progressBar: $("progressBar"),
  dayTabs: $("dayTabs"),
  daySelect: $("daySelect"),
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
  accountDropdown: $("accountDropdown"),
  accountBtn: $("accountBtn"),
  accountMenu: $("accountMenu"),
  accountInitials: $("accountInitials"),
  accountInitialsMenu: $("accountInitialsMenu"),
  accountEmailMenu: $("accountEmailMenu"),
  accountSignOut: $("accountSignOut"),
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
  els.baseline.value = state.config.baseline ?? 20;
  els.target.value = state.config.target ?? 0;
  els.totalDays.value = state.config.totalDays ?? 10;
  els.modeSelect.value = state.config.mode ?? "quit";
  els.curve.value = state.config.curve ?? "linear";
  els.weed.value = state.config.weed ?? "0";
  els.firstTime.value = state.config.firstTime ?? "11:42";
  els.wake.value = state.config.wake ?? "08:00";
  els.sleep.value = state.config.sleep ?? "21:30";
  els.pattern.value = state.config.pattern ?? "auto";
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
  els.baseline.value = 20;
  els.target.value = 0;
  els.totalDays.value = 10;
  els.modeSelect.value = "quit";
  els.curve.value = "linear";
  els.weed.value = "0";
  els.firstTime.value = "11:42";
  els.wake.value = "08:00";
  els.sleep.value = "21:30";
  els.pattern.value = "auto";
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

/* Taper engine */
function generateCapsFromCurve() {
  const B = Number(els.baseline.value) || 0;
  let T = Number(els.target.value) || 0;
  const N = Number(els.totalDays.value) || 1;
  const mode = els.modeSelect.value;

  if (mode === "quit") T = 0;
  if (N <= 1) return [Math.max(T, 0)];

  const curve = els.curve.value;
  const caps = [];

  for (let i = 1; i <= N; i++) {
    const p = (i - 1) / (N - 1);
    let e = p;
    if (curve === "gentle") {
      e = 3 * p * p - 2 * p * p * p;
    } else if (curve === "aggressive") {
      e = Math.sqrt(p);
    }
    let cap = Math.round(B + (T - B) * e);
    if (cap < 0) cap = 0;
    caps.push(cap);
  }
  caps[N - 1] = Math.max(T, 0);
  return caps;
}

function makePattern() {
  const total = Number(els.totalDays.value) || 1;
  if (els.pattern.value === "custom") {
    let caps = els.customPattern.value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    if (!caps.length) caps = [0];
    if (caps.length < total) {
      const last = caps[caps.length - 1] ?? 0;
      while (caps.length < total) caps.push(last);
    }
    return caps.slice(0, total);
  }
  return generateCapsFromCurve();
}

function generatePlan() {
  const caps = makePattern();
  const wake = parseMinutes(els.wake.value);
  const sleep = parseMinutes(els.sleep.value);
  const first = parseMinutes(els.firstTime.value);
  const usableStart = Math.max(first, wake);
  const totalDays = Number(els.totalDays.value) || caps.length;
  const B = Number(els.baseline.value) || 0;
  const mode = els.modeSelect.value;
  const T = mode === "quit" ? 0 : Number(els.target.value) || 0;

  state.config = {
    baseline: B,
    target: T,
    mode,
    curve: els.curve.value,
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
      mode === "quit" && cap === 0 ? "Quit" :
      day === totalDays && cap === T && T > 0 ? "Target limit" :
      cap >= B ? "Stabilize" :
      cap >= T ? "Reduce" :
      "Fine-tune";

    state.plan.push({ day, cap, phase, slots });
  }

  state.config.quitDay = totalDays ? `Day ${totalDays}` : "—";

  els.setupModal.classList.remove("open");
  syncAll(true);
}

/* Accessors */
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

/* Rendering */
function renderDaySelect() {
  els.daySelect.innerHTML = "";
  if (!state.plan.length) return;
  state.plan.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = String(p.day);
    opt.textContent = `Day ${p.day}`;
    if (p.day === state.activeDay) opt.selected = true;
    els.daySelect.appendChild(opt);
  });
}
els.daySelect.onchange = () => {
  state.activeDay = Number(els.daySelect.value) || 1;
  syncAll();
};

function renderTabs() {
  els.dayTabs.innerHTML = "";
  if (!state.plan.length) return;
  state.plan.forEach((p) => {
    const b = document.createElement("button");
    b.className = `tab ${p.day === state.activeDay ? "active" : ""}`;
    b.textContent = `Day ${p.day}`;
    b.onclick = () => {
      state.activeDay = p.day;
      els.daySelect.value = String(p.day);
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
    els.slotList.innerHTML =
      `<div class="rule"><strong>Day ${p.day}</strong><div class="muted">${
        state.config.mode === "quit" && p.day === state.config.totalDays
          ? "Quit day. Zero cigarettes."
          : "Zero cigarettes. Protect the line."
      }</div></div>`;
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
    els.baselineStat.textContent = `${state.config?.baseline ?? 0}/day`;
    els.targetStat.textContent = `${state.config?.target ?? 0}/day`;
    els.nextSlotStat.textContent = "—";
    els.quitDayStat.textContent = state.config?.quitDay ?? "—";
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
  els.targetStat.textContent = `${state.config?.target ?? 0}/day`;
  els.nextSlotStat.textContent = unresolved(p.day)[0]?.time ?? "None";
  els.quitDayStat.textContent = state.config?.quitDay ?? "—";

  const modeLabel =
    state.config?.mode === "quit"
      ? "Quit trajectory"
      : `Limit to ${state.config?.target ?? 0}/day`;
  els.heroPill.textContent =
    state.config?.weed === "1"
      ? `${modeLabel} • Weed still active`
      : `${modeLabel} • Weed locked at 0`;

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
    els.countdownText.textContent =
      state.config?.mode === "quit" && p.day === state.config.totalDays
        ? "Quit day. No more cigarettes."
        : "No cigarettes scheduled for this day.";
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

/* Cravings */
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

/* Actions */
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
  renderDaySelect();
  renderTabs();
  renderSlots();
  renderPlanMap();
  updateStats();
  updateCountdown();
  renderLogs();
}

/* Notifications */
function clearLocalTimers() {
  state.localTimers.forEach((id) => clearTimeout(id));
  state.localTimers = [];
}

function scheduleLocalNotifications() {
  clearLocalTimers();
  if (!state.notificationsEnabled || !("Notification" in window)) return;

  const now = new Date();
  const nowMs = now.getTime();

  state.plan.forEach((p) => {
    p.slots.forEach((time, idx) => {
      const [h, m] = time.split(":").map(Number);
      const slotDate = new Date();
      slotDate.setHours(h, m, 0, 0);
      const delay = slotDate.getTime() - nowMs;
      if (delay <= 0) return;

      const id = setTimeout(() => {
        new Notification("Cigarette slot open", {
          body: `Day ${p.day}, slot #${idx + 1} at ${time}`,
          tag: `slot-${p.day}-${idx}`,
        });
      }, delay);
      state.localTimers.push(id);
    });
  });
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("Notifications are not supported in this browser.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Notifications not enabled. Please allow them in your browser.");
    return;
  }
  state.notificationsEnabled = true;
  scheduleLocalNotifications();

  try {
    const token = await getToken(messaging, {
      vapidKey: "YOUR_PUBLIC_VAPID_KEY_HERE",
    });
    state.fcmToken = token;
    if (state.user) {
      await setDoc(
        doc(db, "quitPlans", state.user.uid),
        { fcmToken: token, fcmUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn("FCM token error", e);
  }
}
els.notificationsBtn.onclick = enableNotifications;

onMessage(messaging, (payload) => {
  console.log("FCM foreground message", payload);
});

function syncAll(fromSetup = false) {
  if (state.mode === "user") saveStateLocal();
  renderRoot();
  if (state.mode === "user" && state.user) saveStateCloud();
  if (fromSetup) scheduleLocalNotifications();
}

/* Cloud sync */
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

/* Auth UI & gate */
function updateAuthUI() {
  if (state.mode === "user" && state.user) {
    els.authStatus.textContent = `Signed in as ${state.user.email}`;
    els.sidebarAuthForm.style.display = "none";
    els.btnSignOut.style.display = "block";
    els.authHint.textContent =
      "Progress is synced to your private cloud profile.";

    const email = state.user.email || "";
    const initials = email
      ? email[0].toUpperCase()
      : "A";
    els.accountInitials.textContent = initials;
    els.accountInitialsMenu.textContent = initials;
    els.accountEmailMenu.textContent = email;
    els.accountDropdown.style.display = "block";
  } else if (state.mode === "offline") {
    els.authStatus.textContent = "Offline mode";
    els.sidebarAuthForm.style.display = "block";
    els.btnSignOut.style.display = "none";
    els.authHint.textContent =
      "Offline profile: everything stays on this browser until you sign in.";
    els.accountDropdown.style.display = "none";
  } else {
    els.authStatus.textContent = "Offline only";
    els.sidebarAuthForm.style.display = "block";
    els.btnSignOut.style.display = "none";
    els.authHint.textContent =
      "Not required; the app works offline. Sign in only if you want cross‑device sync.";
    els.accountDropdown.style.display = "none";
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
  await setPersistence(auth, browserSessionPersistence); // session-only [web:523][web:533][web:538]
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  return cred.user;
}
async function doSignIn(email, pass) {
  await setPersistence(auth, browserSessionPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

/* Setup prompt */
function openSetupPrompt(firstTime = false) {
  els.setupModal.classList.add("open");
  els.setupHint.textContent = firstTime
    ? "New profile: set a realistic target and days. You can always regenerate the plan."
    : "Reset completed. Adjust your baseline, target, and days, then regenerate the plan.";
}

/* Account dropdown interactions */
els.accountBtn.onclick = () => {
  if (!state.user) {
    // If not signed in, open sidebar auth form instead
    els.sidebar.classList.add("open");
    els.sidebarOverlay.classList.add("open");
    return;
  }
  const open = els.accountDropdown.classList.contains("open");
  if (open) {
    els.accountDropdown.classList.remove("open");
  } else {
    els.accountDropdown.classList.add("open");
  }
};
document.addEventListener("click", (ev) => {
  if (!els.accountDropdown) return;
  if (ev.target === els.accountBtn || els.accountDropdown.contains(ev.target)) return;
  els.accountDropdown.classList.remove("open");
});
els.accountSignOut.onclick = async () => {
  await signOut(auth);
  state.user = null;
  state.mode = "offline";
  updateAuthUI();
  els.accountDropdown.classList.remove("open");
};

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
      await initializeNewUserState(user, true);
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
  openSetupPrompt(true);
};

els.btnSignUp.onclick = async () => {
  const email = els.authEmail.value.trim();
  const pass = els.authPassword.value;
  if (!email || !pass) return;
  try {
    const user = await doSignUp(email, pass);
    await initializeNewUserState(user, true);
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

  clearLocalTimers();
  state.plan = [];
  state.smoked = {};
  state.skipped = {};
  state.logs = [];
  state.config = null;
  state.activeDay = 1;

  if (state.mode === "user" && state.user) {
    try {
      await deleteDoc(doc(db, "quitPlans", state.user.uid));
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  setTheme(state.theme);
  renderRoot();
  openSetupPrompt(false);
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
  setTheme(state.theme);
  renderRoot();
  updateAuthUI();
}

async function initializeNewUserState(user, firstTime) {
  state.user = user;
  state.mode = "user";
  setTheme(state.theme);
  updateAuthUI();
  showApp();
  openSetupPrompt(firstTime);
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
      await initializeNewUserState(user, true);
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
    // Session persistence: only active while tab is open, not across browser restarts. [web:523][web:540]
    await handleUserAuth(user);
    return;
  }
  state.user = null;
  const offlineFlag = localStorage.getItem(OFFLINE_FLAG);
  if (offlineFlag === "1") {
    initOfflineZeroState();
    showApp();
    openSetupPrompt(true);
  } else {
    state.mode = "unauth";
    updateAuthUI();
    showGate();
  }
});

els.generatePlan.onclick = () => generatePlan();

setTheme(state.theme);
setInterval(updateCountdown, 1000);
