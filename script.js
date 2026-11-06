"use strict";
const ITEMS = Object.freeze(["vim", "neovim", "vscode", "emacs"]);
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
function getColors() { return ["#fbb", "#bfb", "#bbf", "#ffc"]; }

async function reportResult(result) {
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  if (!token) return; // 静的ページで開いた場合は結果の表示のみ。
  try {
    const response = await fetch("/result", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token, result})
    });
    if (!response.ok) throw new Error("Result delivery failed");
  } catch (error) {
    document.getElementById("resultDisplay").textContent += "（結果を Bash に返せませんでした）";
    console.error(error);
  }
}

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
  let startAngle = Math.random() * 2 * Math.PI;
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

    velocity *= friction;
    const stopThresholdMap = { slow: 0.0005, normal: 0.002, fast: 0.01 };
    const stopThreshold = stopThresholdMap[frictionLevel] || 0.002;

    if (velocity < stopThreshold) {
      const chosen = Math.floor(((2 * Math.PI - startAngle % (2 * Math.PI)) % (2 * Math.PI)) / slice);
      resultDisplay.textContent = `🎯 選ばれたのは: ${items[chosen]}`;
      reportResult(items[chosen]);
    } else {
      startAngle += velocity;
      requestAnimationFrame(drawWheel);
    }
  }

  drawWheel();
}


spinWheel(ITEMS, "pastel", "normal");
