const usersEl = document.getElementById("users");
const statusEl = document.getElementById("status");

const STATUS_TEXT = {
  connecting: "Подключение к Discord…",
  authorizing: "Разрешите доступ в окне Discord",
  waiting: "Жду запуск Discord…",
  nosecret: "Не найден .env с DISCORD_CLIENT_SECRET (положите рядом с программой)",
};

const rows = new Map(); // id -> { el, img, name }

function createRow(id) {
  const el = document.createElement("div");
  el.className = "user";

  const img = document.createElement("img");
  img.className = "avatar";

  const name = document.createElement("span");
  name.className = "name";

  el.append(img, name);
  usersEl.appendChild(el);
  const row = { el, img, name };
  rows.set(id, row);
  return row;
}

function render({ status, members }) {
  // статус показываем только пока нет подключения
  const text = STATUS_TEXT[status];
  statusEl.style.display = text ? "block" : "none";
  statusEl.textContent = text || "";

  // обновляем только изменившееся, чтобы анимации не сбрасывались
  const seen = new Set();
  for (const m of members) {
    seen.add(m.id);
    const row = rows.get(m.id) || createRow(m.id);
    row.el.className =
      "user" +
      (m.speaking ? " speaking" : "") +
      (m.muted ? " muted" : "") +
      (m.deafened ? " deafened" : "");
    if (row.img.dataset.src !== m.avatar) {
      row.img.dataset.src = m.avatar;
      row.img.src = m.avatar;
    }
    if (row.name.textContent !== m.name) row.name.textContent = m.name;
  }

  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.el.remove();
      rows.delete(id);
    }
  }
}

// ---------- настройки внешнего вида ----------
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function applySettings(s) {
  const r = document.documentElement.style;
  r.setProperty("--idle-opacity", s.idleOpacity);
  r.setProperty("--speaking-opacity", s.speakingOpacity);
  r.setProperty("--avatar-dim", s.avatarDim);
  r.setProperty("--avatar-size", s.avatarSize + "px");
  r.setProperty("--font-size", s.fontSize + "px");
  r.setProperty("--spacing", s.spacing + "px");
  r.setProperty("--radius", s.avatarRadius + "px");
  r.setProperty("--speaking-color", s.speakingColor);
  r.setProperty("--text-color", s.textColor);
  r.setProperty("--muted-color", s.mutedColor);
  r.setProperty("--name-bg", hexToRgba(s.nameBg, s.nameBgOpacity));
  r.setProperty("--float", (s.floatEnabled ? s.floatDistance : 0) + "px");
  r.setProperty("--pad", (s.floatEnabled ? s.floatDistance : 0) + 2 + "px");
  document.body.classList.toggle("right", s.anchor.includes("right"));
  document.body.classList.toggle("bottom", s.anchor.includes("bottom"));
}

window.overlay.onSettings(applySettings);
window.overlay.onEdit((on) => document.body.classList.toggle("edit", !!on));
window.overlay.onState(render);
