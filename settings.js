// Описание всех настроек: как называются, какие бывают значения.
// Хотите добавить свою настройку - допишите сюда строку (и ключ в main.js, DEFAULTS и RANGES).
const GROUPS = [
  { title: "Прозрачность", items: [
    { key: "idleOpacity", label: "Те, кто молчит", type: "range", min: 0.05, max: 1, step: 0.05 },
    { key: "speakingOpacity", label: "Те, кто говорит", type: "range", min: 0.05, max: 1, step: 0.05 },
    { key: "avatarDim", label: "Затемнение аватарки у молчащих", type: "range", min: 0.1, max: 1, step: 0.05 },
  ]},
  { title: "Размеры", items: [
    { key: "avatarSize", label: "Размер аватарки, px", type: "range", min: 16, max: 128, step: 1 },
    { key: "avatarRadius", label: "Скругление аватарки, px", type: "range", min: 0, max: 64, step: 1 },
    { key: "fontSize", label: "Размер текста, px", type: "range", min: 8, max: 32, step: 1 },
    { key: "spacing", label: "Расстояние между строками, px", type: "range", min: 0, max: 40, step: 1 },
  ]},
  { title: "Цвета", items: [
    { key: "speakingColor", label: "Рамка говорящего", type: "color" },
    { key: "textColor", label: "Текст", type: "color" },
    { key: "mutedColor", label: "Текст замьюченного", type: "color" },
    { key: "nameBg", label: "Фон плашки с именем", type: "color" },
    { key: "nameBgOpacity", label: "Непрозрачность плашки", type: "range", min: 0, max: 1, step: 0.05 },
  ]},
  { title: "Анимация", items: [
    { key: "floatEnabled", label: "Подпрыгивание говорящего", type: "check" },
    { key: "floatDistance", label: "Высота подпрыгивания, px", type: "range", min: 0, max: 20, step: 1 },
  ]},
  { title: "Положение и размер окна", hint: "Включите «Режим перемещения» вверху: появится рамка окна, и его можно двигать мышью. Если аватарки обрезаются по краю рамки, увеличьте ширину или высоту. Оверлей прижимается к выбранному углу свободной области экрана, то есть над панелью задач.", items: [
    { key: "anchor", label: "Угол экрана", type: "select", options: [
      ["top-left", "Верхний левый"], ["top-right", "Верхний правый"],
      ["bottom-left", "Нижний левый"], ["bottom-right", "Нижний правый"] ] },
    { key: "marginX", label: "Отступ от края слева/справа, px", type: "range", min: 0, max: 1500, step: 1 },
    { key: "marginY", label: "Отступ от края сверху/снизу, px", type: "range", min: 0, max: 1000, step: 1 },
    { key: "width", label: "Ширина окна, px", type: "range", min: 120, max: 1200, step: 5 },
    { key: "height", label: "Высота окна, px", type: "range", min: 100, max: 2000, step: 5 },
    { key: "aboveTaskbar", label: "Показывать поверх панели задач", type: "check" },
  ]},
  { title: "Система", hint: "Автозапуск работает, пока папка проекта лежит на месте. Если её перенесли, снимите галочку и поставьте заново.", items: [
    { key: "autoStart", label: "Запускать вместе с Windows", type: "check" },
  ]},
];

const form = document.getElementById("form");
const controls = {}; // key -> { input, item, val }

function fmt(v, item) {
  return item.step && item.step < 1 ? Number(v).toFixed(2) : String(v);
}

function build(s) {
  form.innerHTML = "";
  for (const g of GROUPS) {
    const h = document.createElement("h2");
    h.textContent = g.title;
    form.appendChild(h);
    if (g.hint) {
      const p = document.createElement("div");
      p.className = "hint";
      p.textContent = g.hint;
      form.appendChild(p);
    }
    for (const item of g.items) {
      const row = document.createElement("div");
      row.className = "row" + (item.type === "range" ? "" : " simple");
      const label = document.createElement("label");
      label.textContent = item.label;

      let input;
      if (item.type === "select") {
        input = document.createElement("select");
        for (const [v, t] of item.options) {
          const o = document.createElement("option");
          o.value = v;
          o.textContent = t;
          input.appendChild(o);
        }
        input.value = s[item.key];
      } else if (item.type === "check") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!s[item.key];
      } else {
        input = document.createElement("input");
        input.type = item.type;
        if (item.min !== undefined) input.min = item.min;
        if (item.max !== undefined) input.max = item.max;
        if (item.step !== undefined) input.step = item.step;
        input.value = s[item.key];
      }
      row.append(label, input);
      let val;
      if (item.type === "range") {
        val = document.createElement("span");
        val.className = "val";
        val.textContent = fmt(s[item.key], item);
        row.appendChild(val);
      }

      controls[item.key] = { input, item, val };

      input.addEventListener("input", () => {
        let v;
        if (item.type === "check") v = input.checked;
        else if (item.type === "range" || item.type === "number") v = Number(input.value);
        else v = input.value;
        if (val) val.textContent = fmt(v, item);
        window.settingsApi.set({ [item.key]: v });
      });
      form.appendChild(row);
    }
  }
}

// обновляет значения без перестройки формы (например, после перетаскивания оверлея мышью)
function setValues(s) {
  for (const [key, c] of Object.entries(controls)) {
    if (!(key in s)) continue;
    if (c.item.type === "check") c.input.checked = !!s[key];
    else c.input.value = s[key];
    if (c.val) c.val.textContent = fmt(s[key], c.item);
  }
}

window.settingsApi.get().then(build);
window.settingsApi.onChanged(setValues);

document.getElementById("reset").addEventListener("click", async () => {
  build(await window.settingsApi.reset());
});

const demo = document.getElementById("demo");
demo.addEventListener("change", () => window.settingsApi.demo(demo.checked));

// режим перемещения включает и тестовых участников, чтобы было что двигать
const edit = document.getElementById("edit");
edit.addEventListener("change", () => {
  window.settingsApi.edit(edit.checked);
  if (edit.checked && !demo.checked) {
    demo.checked = true;
    window.settingsApi.demo(true);
  }
});
