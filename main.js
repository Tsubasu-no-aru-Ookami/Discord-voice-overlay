const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// Папка с данными фиксируется, чтобы вход, настройки и лог не терялись при переходе на exe-сборку
app.setPath("userData", path.join(app.getPath("appData"), "discord-voice-overlay"));

// ---------- лог (в exe консоли нет, ошибки смотрим в файле) ----------
const logFile = path.join(app.getPath("userData"), "overlay.log");
try {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  if (fs.existsSync(logFile) && fs.statSync(logFile).size > 200 * 1024) fs.unlinkSync(logFile);
} catch {}
for (const level of ["log", "error"]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    try {
      fs.appendFileSync(logFile, `${new Date().toISOString()} [${level}] ${args.join(" ")}\n`);
    } catch {}
  };
}

// ---------- секрет из файла .env ----------
// Ищем по порядку: папка проекта, рядом с exe, папка данных приложения
const envCandidates = [
  path.join(__dirname, ".env"),
  path.join(path.dirname(process.execPath), ".env"),
  path.join(app.getPath("userData"), ".env"),
];
for (const file of envCandidates) {
  if (fs.existsSync(file)) {
    require("dotenv").config({ path: file });
    break;
  }
}
const { Client } = require("@xhayper/discord-rpc");

// ---------- настройки подключения ----------
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1554615178065084516";
const CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || "").trim();
const SCOPES = ["rpc", "rpc.voice.read"];
const RETRY_MS = 5000;
const VOICE_EVENTS = [
  "VOICE_STATE_CREATE",
  "VOICE_STATE_UPDATE",
  "VOICE_STATE_DELETE",
  "SPEAKING_START",
  "SPEAKING_STOP",
];

// ---------- настройки внешнего вида ----------
// Значения по умолчанию. Менять удобнее через значок в трее -> "Настройки".
const DEFAULTS = {
  idleOpacity: 0.45, // прозрачность тех, кто молчит (1 = полностью видно)
  speakingOpacity: 1, // прозрачность говорящих
  avatarDim: 0.4, // затемнение аватарки у молчащих
  avatarSize: 40,
  avatarRadius: 6,
  fontSize: 12,
  spacing: 4,
  speakingColor: "#00ff62",
  textColor: "#ffffff",
  mutedColor: "#ff9a9a",
  nameBg: "#000000",
  nameBgOpacity: 0.79,
  floatEnabled: true,
  floatDistance: 4,
  anchor: "top-left", // top-left | top-right | bottom-left | bottom-right
  marginX: 5,
  marginY: 5,
  width: 450, // размер окна; если аватарки обрезаются, окно нужно увеличить
  height: 700,
  aboveTaskbar: false, // false: оверлей остаётся в свободной области и не закрывает панель задач
  autoStart: false, // запускать вместе с Windows
  displayId: 0, // на каком мониторе оверлей (0 = основной), запоминается при перетаскивании
};

const RANGES = {
  idleOpacity: [0.05, 1],
  speakingOpacity: [0.05, 1],
  avatarDim: [0.1, 1],
  avatarSize: [16, 128],
  avatarRadius: [0, 64],
  fontSize: [8, 32],
  spacing: [0, 40],
  nameBgOpacity: [0, 1],
  floatDistance: [0, 20],
  marginX: [0, 3000],
  marginY: [0, 3000],
  width: [120, 2000],
  height: [100, 3000],
};
const ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const COLOR_KEYS = ["speakingColor", "textColor", "mutedColor", "nameBg"];
const BOOL_KEYS = ["floatEnabled", "aboveTaskbar", "autoStart"];

let settings = { ...DEFAULTS };
let settingsSaveTimer = null;

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

// отбрасывает неправильные значения и приводит числа к допустимым границам
function sanitize(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULTS)) continue;
    if (RANGES[k]) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = Math.min(RANGES[k][1], Math.max(RANGES[k][0], n));
    } else if (COLOR_KEYS.includes(k)) {
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    } else if (BOOL_KEYS.includes(k)) {
      out[k] = !!v;
    } else if (k === "anchor") {
      if (ANCHORS.includes(v)) out[k] = v;
    } else if (k === "displayId") {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    settings = { ...DEFAULTS, ...sanitize(saved) };
  } catch {
    settings = { ...DEFAULTS };
  }
}

function saveSettingsSoon() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error("Не удалось сохранить настройки:", e.message);
    }
  }, 300);
}

// ---------- состояние ----------
let win = null;
let settingsWin = null;
let editMode = false; // режим перемещения оверлея мышью (не сохраняется)
let tray = null;
let client = null;
let retryTimer = null;
let saveTimer = null;
let quitting = false;
let status = "connecting"; // connecting | authorizing | connected | waiting | nosecret
let subs = [];
let joinGen = 0;
const members = new Map(); // id -> { id, name, avatar, muted, deafened, speaking }

// ---------- тестовые участники (для настройки вида) ----------
let demo = false;
let demoTimer = null;
let demoTick = 0;
const demoAvatar = (i) => `https://cdn.discordapp.com/embed/avatars/${i}.png`;
const DEMO_NAMES = ["Noraノラ", "ほんひま", "社築", "戌亥とこ"];

function demoMembers() {
  return DEMO_NAMES.map((name, i) => ({
    id: "demo" + i,
    name,
    avatar: demoAvatar(i),
    muted: i === 1,
    deafened: false,
    speaking: i === demoTick % DEMO_NAMES.length,
  }));
}

function setDemo(on) {
  demo = !!on;
  clearInterval(demoTimer);
  demoTimer = null;
  if (demo) {
    demoTick = 0;
    demoTimer = setInterval(() => {
      demoTick++;
      push();
    }, 1500);
  }
  push();
}

// ---------- отправка в окно ----------
function push() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(
    "state",
    demo
      ? { status: "connected", members: demoMembers() }
      : { status, members: [...members.values()] }
  );
}

function pushSettings() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("settings", settings);
}

function setStatus(s) {
  status = s;
  push();
}

// ---------- положение окна ----------
function targetDisplay() {
  const found = screen.getAllDisplays().find((d) => d.id === settings.displayId);
  return found || screen.getPrimaryDisplay();
}

function applyBounds() {
  if (!win || win.isDestroyed()) return;
  const display = targetDisplay();
  // workArea - экран без панели задач, поэтому оверлей её не закрывает
  const area = settings.aboveTaskbar ? display.bounds : display.workArea;
  const w = Math.min(settings.width, area.width);
  const h = Math.min(settings.height, area.height);
  const x = settings.anchor.includes("right")
    ? area.x + area.width - w - settings.marginX
    : area.x + settings.marginX;
  const y = settings.anchor.includes("bottom")
    ? area.y + area.height - h - settings.marginY
    : area.y + settings.marginY;
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
  // "screen-saver" поднимает окно над панелью задач, обычный уровень - нет
  win.setAlwaysOnTop(true, settings.aboveTaskbar ? "screen-saver" : "floating");
}

// ---------- автозапуск с Windows ----------
function loginItemOptions() {
  // пути с пробелами нужны в кавычках
  const q = (p) => (/\s/.test(p) ? `"${p}"` : p);
  // exe-сборка: запускается сам файл
  if (app.isPackaged) return { path: q(process.execPath), args: [] };
  // запуск из папки проекта: electron.exe + путь к проекту
  return { path: q(process.execPath), args: [q(app.getAppPath())] };
}

function applyAutoStart() {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!settings.autoStart, ...loginItemOptions() });
  } catch (e) {
    console.error("Автозапуск не настроился:", e.message);
  }
}

function updateSettings(patch) {
  const before = settings.autoStart;
  settings = { ...settings, ...sanitize(patch) };
  saveSettingsSoon();
  pushSettings();
  applyBounds();
  if (settings.autoStart !== before) applyAutoStart();
  return settings;
}

// ---------- режим перемещения ----------
function setEditMode(on) {
  editMode = !!on;
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!editMode); // в обычном режиме клики проходят сквозь оверлей
  win.setFocusable(editMode);
  win.webContents.send("edit", editMode);
}

// после перетаскивания пересчитываем отступы от угла (и запоминаем монитор)
function onMoved() {
  if (!editMode || !win || win.isDestroyed()) return;
  const b = win.getBounds();
  const d = screen.getDisplayMatching(b);
  const area = settings.aboveTaskbar ? d.bounds : d.workArea;
  const right = settings.anchor.includes("right");
  const bottom = settings.anchor.includes("bottom");
  const marginX = Math.round(right ? area.x + area.width - (b.x + b.width) : b.x - area.x);
  const marginY = Math.round(bottom ? area.y + area.height - (b.y + b.height) : b.y - area.y);
  const next = sanitize({ marginX, marginY });
  if (d.id === settings.displayId && next.marginX === settings.marginX && next.marginY === settings.marginY) return;
  updateSettings({ displayId: d.id, marginX, marginY }); // за границу области не выпускаем: окно вернётся на край
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("settings-changed", settings);
}

// ---------- сохранение входа (чтобы не просить разрешение каждый раз) ----------
const tokenFile = () => path.join(app.getPath("userData"), "rpc-token.json");

function readRefreshToken() {
  try {
    return JSON.parse(fs.readFileSync(tokenFile(), "utf8")).refreshToken || null;
  } catch {
    return null;
  }
}

function writeRefreshToken(token) {
  try {
    if (token) fs.writeFileSync(tokenFile(), JSON.stringify({ refreshToken: token }));
  } catch (e) {
    console.error("Не удалось сохранить токен:", e.message);
  }
}

function clearRefreshToken() {
  try {
    fs.unlinkSync(tokenFile());
  } catch {}
}

// ---------- данные участников ----------
function avatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  let idx = 0;
  try {
    const disc = Number(user.discriminator || 0);
    idx = disc > 0 ? disc % 5 : Number((BigInt(user.id) >> 22n) % 6n);
  } catch {}
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

// entry: { user, nick, mute, voice_state: { mute, deaf, self_mute, self_deaf } }
function upsertMember(entry) {
  const u = entry?.user;
  if (!u?.id) return;
  const vs = entry.voice_state || {};
  const prev = members.get(u.id);
  members.set(u.id, {
    id: u.id,
    name: entry.nick || u.global_name || u.username || "Unknown",
    avatar: avatarUrl(u),
    muted: !!(entry.mute || vs.mute || vs.self_mute || vs.deaf || vs.self_deaf),
    deafened: !!(vs.deaf || vs.self_deaf),
    speaking: prev ? prev.speaking : false,
  });
}

// ---------- работа с голосовым каналом ----------
async function unsubscribeAll() {
  const old = subs;
  subs = [];
  for (const s of old) {
    try {
      await s.unsubscribe();
    } catch {}
  }
}

async function joinChannel(c, channelId) {
  const gen = ++joinGen;
  await unsubscribeAll();
  members.clear();
  push();
  if (!channelId) return;

  const ch = await c.request("GET_CHANNEL", { channel_id: channelId });
  if (gen !== joinGen) return;
  for (const entry of ch.data?.voice_states || []) upsertMember(entry);
  push();

  for (const evt of VOICE_EVENTS) {
    const sub = await c.subscribe(evt, { channel_id: channelId });
    if (gen !== joinGen) {
      try {
        await sub.unsubscribe();
      } catch {}
      return;
    }
    subs.push(sub);
  }
}

function attachHandlers(c) {
  const onState = (d) => {
    upsertMember(d);
    push();
  };
  c.on("VOICE_STATE_CREATE", onState);
  c.on("VOICE_STATE_UPDATE", onState);
  c.on("VOICE_STATE_DELETE", (d) => {
    if (d?.user?.id) members.delete(d.user.id);
    push();
  });
  c.on("SPEAKING_START", (d) => {
    const m = members.get(d?.user_id);
    if (m) {
      m.speaking = true;
      push();
    }
  });
  c.on("SPEAKING_STOP", (d) => {
    const m = members.get(d?.user_id);
    if (m) {
      m.speaking = false;
      push();
    }
  });
  c.on("VOICE_CHANNEL_SELECT", (d) => {
    joinChannel(c, d?.channel_id).catch((e) => console.error("joinChannel:", e.message));
  });
}

// ---------- подключение к Discord ----------
function scheduleRetry() {
  if (quitting || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, RETRY_MS);
}

async function login(c) {
  const refreshToken = readRefreshToken();
  if (refreshToken) {
    try {
      await c.login({ scopes: SCOPES, refreshToken });
      return;
    } catch (e) {
      console.log("Сохранённый вход не подошёл, запрашиваю заново:", e.message);
      clearRefreshToken();
    }
  }
  setStatus("authorizing");
  await c.login({ scopes: SCOPES });
}

async function connect() {
  if (quitting) return;
  if (!CLIENT_SECRET) {
    console.error("Не задан DISCORD_CLIENT_SECRET (файл .env)");
    setStatus("nosecret");
    return;
  }

  const c = new Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
  client = c;
  setStatus("connecting");
  attachHandlers(c);

  c.on("disconnected", () => {
    if (client !== c) return;
    client = null;
    joinGen++;
    subs = [];
    members.clear();
    setStatus("waiting");
    scheduleRetry();
  });

  try {
    await login(c);
    writeRefreshToken(c.refreshToken);
    setStatus("connected");
    await c.subscribe("VOICE_CHANNEL_SELECT");
    const cur = await c.request("GET_SELECTED_VOICE_CHANNEL");
    await joinChannel(c, cur.data?.id);
  } catch (e) {
    console.error("Ошибка подключения:", e.code, e.message);
    if (client === c) client = null;
    try {
      await c.destroy();
    } catch {}
    members.clear();
    setStatus("waiting");
    scheduleRetry();
  }
}

// токен Discord периодически обновляется, сохраняем свежий
function startTokenSaver() {
  saveTimer = setInterval(() => {
    if (client?.refreshToken) writeRefreshToken(client.refreshToken);
  }, 5 * 60 * 1000);
}

// ---------- окна ----------
function createWindow() {
  win = new BrowserWindow({
    width: settings.width,
    height: settings.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setIgnoreMouseEvents(true); // клики проходят сквозь оверлей
  applyBounds();
  win.loadFile("index.html");
  win.on("moved", onMoved);
  win.webContents.on("did-finish-load", () => {
    pushSettings();
    push();
    win.webContents.send("edit", editMode);
  });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 500,
    height: 820,
    title: "Оверлей: настройки",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile("settings.html");
  settingsWin.on("closed", () => {
    settingsWin = null;
    if (editMode) setEditMode(false); // режим перемещения и тестовых участников после закрытия не оставляем
    if (demo) setDemo(false);
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")));
  tray.setToolTip("Discord voice overlay");
  const menu = Menu.buildFromTemplate([
    { label: "Настройки…", click: openSettings },
    { label: "Папка с данными и логом", click: () => shell.openPath(app.getPath("userData")) },
    {
      label: "Показать / скрыть оверлей",
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) win.hide();
        else win.showInactive();
      },
    },
    { type: "separator" },
    { label: "Выход", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", openSettings);
}

// ---------- обмен с окном настроек ----------
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:set", (_e, patch) => updateSettings(patch));
ipcMain.handle("settings:reset", () => updateSettings({ ...DEFAULTS, autoStart: settings.autoStart }));
ipcMain.handle("settings:edit", (_e, on) => setEditMode(on));
ipcMain.handle("settings:demo", (_e, on) => setDemo(on));

// ---------- запуск ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", openSettings);

  app.whenReady().then(() => {
    loadSettings();
    if (settings.autoStart) applyAutoStart(); // обновляет запись, если папку проекта переносили
    createWindow();
    createTray();
    startTokenSaver();
    connect();
    screen.on("display-metrics-changed", applyBounds);
  });

  app.on("before-quit", () => {
    quitting = true;
    clearInterval(saveTimer);
    clearInterval(demoTimer);
    clearTimeout(retryTimer);
    if (client?.refreshToken) writeRefreshToken(client.refreshToken);
    try {
      fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
    } catch {}
  });
}
