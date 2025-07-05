const itemCountSelect = document.getElementById("itemCount");
const itemInputs = document.getElementById("itemInputs");
const startButton = document.getElementById("startButton");
const clearSettings = document.getElementById("clearSettings");

const rouletteArea = document.getElementById("rouletteArea");
const settings = document.getElementById("settings");
const retryButton = document.getElementById("retryButton");
const backButton = document.getElementById("backButton");
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

for (let i = 2; i <= 12; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = i;
  itemCountSelect.appendChild(opt);
}

function getColors(count, theme) {
  const baseColors = {
    vivid: ['#f00','#0f0','#00f','#ff0','#f0f','#0ff','#fff','#888','#f80','#08f','#4f4','#f44'],
    pastel: ['#fbb','#bfb','#bbf','#ffc','#fcf','#cff','#eee','#ccc','#fdd','#ddf','#dfd','#f99'],
    gray: ['#111','#222','#333','#444','#555','#666','#777','#888','#999','#aaa','#bbb','#ccc'],
    warm: ['#f00','#f80','#fa0','#f44','#f66','#fbb','#faa','#f22','#f70','#f60','#f50','#f11'],
    cool: ['#00f','#08f','#0ff','#44f','#66f','#bbf','#aaf','#22f','#70f','#60f','#50f','#11f']
  };
  return baseColors[theme || 'vivid'].slice(0, count);
}

function saveSettings(items, theme, frictionLevel) {
  localStorage.setItem("rouletteSettings", JSON.stringify({ items, theme, frictionLevel }));
}

function loadSettings() {
  const data = localStorage.getItem("rouletteSettings");
  return data ? JSON.parse(data) : null;
}

function initItemInputs(count) {
  itemInputs.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const input = document.createElement("input");
    input.value = String(i + 1);
    itemInputs.appendChild(input);
  }
}

function showFlashMessage(message) {
  const flash = document.getElementById("flashMessage");
  flash.textContent = message;
  flash.classList.add("show");
  flash.classList.remove("hidden");

  setTimeout(() => {
    flash.classList.remove("show");
    setTimeout(() => {
      flash.classList.add("hidden");
    }, 500);  // ← CSSのフェードアウトと揃える
  }, 2000);   // ← 表示時間
}

itemCountSelect.addEventListener("change", () => {
  initItemInputs(Number(itemCountSelect.value));
});

startButton.addEventListener("click", () => {
  const count = Number(itemCountSelect.value);
  const items = Array.from(itemInputs.querySelectorAll("input")).map(input => input.value || "未設定");
  const theme = document.getElementById("colorTheme").value;
  const frictionLevel = document.getElementById("frictionLevel").value;
  saveSettings(items, theme, frictionLevel);

  settings.classList.add("hidden");
  rouletteArea.classList.remove("hidden");
  document.body.style.overflow = "hidden";  // ← スクロール禁止

  spinWheel(items, theme, frictionLevel);
});

clearSettings.addEventListener("click", () => {
  localStorage.removeItem("rouletteSettings");
  showFlashMessage("✅ 初期化します");
  setTimeout(() => {
    location.reload();
  }, 2600);  // ← メッセージ消えた後にリロード
});

retryButton.addEventListener("click", () => {
  const saved = loadSettings();
  if (saved) {
    spinWheel(saved.items, saved.theme, saved.frictionLevel || "normal");
  }
});

backButton.addEventListener("click", () => {
  rouletteArea.classList.add("hidden");
  settings.classList.remove("hidden");
  document.body.style.overflow = "auto";  // ← スクロール再許可
});

function expandHex(hex) {
  if (hex.length === 4) {
    return "#" + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  }
  return hex;
}

function getContrastYIQ(hexcolor) {
  hexcolor = expandHex(hexcolor);
  const r = parseInt(hexcolor.substr(1,2),16);
  const g = parseInt(hexcolor.substr(3,2),16);
  const b = parseInt(hexcolor.substr(5,2),16);
  const yiq = (r*299 + g*587 + b*114)/1000;
  const result = yiq >= 128 ? '#000' : '#fff';
  // console.log(`背景色: ${hexcolor} → R:${r}, G:${g}, B:${b}, YIQ:${yiq.toFixed(2)} → 文字色: ${result}`);
  return result;
}

function drawPointer(ctx, center, radius) {
  const pointerLength = 60;
  const pointerWidth = 60;
  const x = center + radius;
  const y = center;
  ctx.fillStyle = "#f00";
  ctx.beginPath();
  ctx.moveTo(x, y);                              // 先端（右端中央）
  ctx.lineTo(x + pointerLength, y - pointerWidth / 2); // 上辺
  ctx.lineTo(x + pointerLength, y + pointerWidth / 2); // 下辺
  ctx.closePath();
  ctx.fill();
}

function spinWheel(items, theme, frictionLevel) {
  let startAngle = 0;
  let velocity = Math.random() * 0.2 + 0.3;
  const frictionMap = { slow: 0.996, normal: 0.98, fast: 0.955 };
  const friction = frictionMap[frictionLevel] || 0.98;
  const colors = getColors(items.length, theme);
  const textColors = colors.map(c => getContrastYIQ(c));
  const resultDisplay = document.getElementById("resultDisplay");

  resultDisplay.textContent = "🎲 抽選中...";

  function drawWheel() {
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    const center = width / 2;
    const radius = center * 0.9;

    ctx.clearRect(0, 0, width, height);

    drawPointer(ctx, center, radius);

    const slice = (2 * Math.PI) / items.length;

    for (let i = 0; i < items.length; i++) {
      const a = startAngle + i * slice;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, a, a + slice);
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(a + slice / 2);
      ctx.fillStyle = textColors[i];
      ctx.font = "bold 16px sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText(items[i], radius * 0.9, 0);
      ctx.restore();
    }

    startAngle += velocity;
    velocity *= friction;
    const stopThresholdMap = { slow: 0.0005, normal: 0.002, fast: 0.01 };
    const stopThreshold = stopThresholdMap[frictionLevel] || 0.002;

    if (velocity < stopThreshold) {
      const chosen = Math.floor(((2 * Math.PI - startAngle % (2 * Math.PI)) % (2 * Math.PI)) / slice);
      resultDisplay.textContent = `🎯 選ばれたのは: ${items[chosen]}`;
    } else {
      requestAnimationFrame(drawWheel);
    }
  }

  drawWheel();
}

// 初期化
const saved = loadSettings();
if (saved) {
  itemCountSelect.value = saved.items.length;
  initItemInputs(saved.items.length);
  saved.items.forEach((val, i) => {
    itemInputs.children[i].value = val;
  });
  document.getElementById("colorTheme").value = saved.theme;
  document.getElementById("frictionLevel").value = saved.frictionLevel || "normal";
} else {
  itemCountSelect.value = 6;
  initItemInputs(6);
}
