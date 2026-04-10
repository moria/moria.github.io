// ======================== 游戏核心逻辑 ========================

// 方向常量: 0=上, 1=右, 2=下, 3=左
const DIR_UP = 0, DIR_RIGHT = 1, DIR_DOWN = 2, DIR_LEFT = 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPPOSITE = [2, 3, 0, 1];

// 方块类型
const T = {
  STRAIGHT: 'STRAIGHT',   // 直线: 2个对向开口
  CURVE:    'CURVE',       // 弯道: 2个相邻开口
  TEE:      'TEE',         // T型: 3个开口
  CROSS:    'CROSS',       // 十字: 4个开口
  BULB:     'BULB',        // 灯泡: 单端接口
  BATTERY:  'BATTERY',     // 电池: 单端输出
};

// 每种类型的基础开口方向（rotation=0时）
const BASE_CONNS = {
  [T.STRAIGHT]: [DIR_UP, DIR_DOWN],     // 上下
  [T.CURVE]:    [DIR_UP, DIR_RIGHT],    // 上右
  [T.TEE]:      [DIR_UP, DIR_RIGHT, DIR_DOWN], // 上右下
  [T.CROSS]:    [DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT],
  [T.BULB]:     [DIR_DOWN],             // 输入口在下
  [T.BATTERY]:  [DIR_UP],               // 输出口在上
};

// 难度配置
const DIFFICULTY = {
  beginner: { cols: 3,  rows: 5  },
  easy:     { cols: 5,  rows: 8  },
  hard:     { cols: 9,  rows: 14 },
};

// 游戏状态
let game = {
  cols: 0, rows: 0,
  grid: [],
  solution: [],    // 保存全连通状态下每个方块的旋转（用于提示/还原）
  difficulty: '',
  timer: 0,
  timerInterval: null,
  paused: false,
  soundOn: localStorage.getItem('bgm_on') !== '0',
  totalBulbs: 0,
  litBulbs: 0,
  cellSize: 50,
  won: false,
  solving: false,  // 正在自动还原中
  animating: false, // 有方块正在旋转动画中
};

// ======================== 音效系统 ========================
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  if (!game.soundOn) return;
  try {
    const ctx = ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'rotate':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'light':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'win': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
          o.start(ctx.currentTime + i * 0.15);
          o.stop(ctx.currentTime + i * 0.15 + 0.3);
        });
        break;
      }
      case 'click':
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
        break;
    }
  } catch (e) {}
}

// ======================== 辅助函数 ========================

function getConns(type, rotation) {
  return new Set(BASE_CONNS[type].map(d => (d + rotation) % 4));
}

function idx(x, y, cols) {
  return y * cols + x;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ======================== 关卡生成 ========================
// 算法：
// 1. 放置电池在底部中间
// 2. 使用DFS生成一棵覆盖所有格子的生成树（从电池出发）
// 3. 叶子节点（无子节点）= 灯泡，内部节点 = 电线
// 4. 根据树结构确定每个格子的电线类型和正确旋转
// 5. 随机打乱所有非电池、非十字的旋转方向

function generatePuzzle(cols, rows) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = null;
    }
  }

  // 1. 放置电池在底部中间
  const batX = Math.floor(cols / 2);
  const batY = rows - 1;
  grid[batY][batX] = { type: T.BATTERY, rotation: 0, lit: false };

  // 2. DFS生成覆盖所有格子的生成树
  const visited = Array.from({ length: rows }, () => new Uint8Array(cols));
  const tree = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ parentDir: -1, children: [] }))
  );

  visited[batY][batX] = 1;

  // 电池先连接上方格子（电池只能向上输出）
  if (batY > 0) {
    visited[batY - 1][batX] = 1;
    tree[batY][batX].children.push(DIR_UP);
    tree[batY - 1][batX].parentDir = DIR_DOWN;
  }

  const dfsStack = [{ x: batX, y: batY - 1 }];

  while (dfsStack.length > 0) {
    const top = dfsStack[dfsStack.length - 1];

    const neighbors = [];
    for (let d = 0; d < 4; d++) {
      const nx = top.x + DX[d], ny = top.y + DY[d];
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        neighbors.push({ d, nx, ny });
      }
    }

    if (neighbors.length === 0) {
      dfsStack.pop();
      continue;
    }

    const { d, nx, ny } = neighbors[Math.floor(Math.random() * neighbors.length)];
    visited[ny][nx] = 1;
    tree[top.y][top.x].children.push(d);
    tree[ny][nx].parentDir = OPPOSITE[d];
    dfsStack.push({ x: nx, y: ny });
  }

  // 3. 根据生成树确定每个格子的类型和旋转
  const solution = [];
  for (let y = 0; y < rows; y++) {
    solution[y] = [];
    for (let x = 0; x < cols; x++) {
      if (x === batX && y === batY) {
        solution[y][x] = 0;
        continue;
      }

      const node = tree[y][x];
      const allDirs = [...node.children];
      if (node.parentDir >= 0) allDirs.push(node.parentDir);

      const uniqueDirs = [...new Set(allDirs)];
      if (uniqueDirs.length === 0) {
        uniqueDirs.push(DIR_UP);
      }

      if (node.children.length === 0) {
        const inputDir = node.parentDir >= 0 ? node.parentDir : uniqueDirs[0];
        const rot = (inputDir - DIR_DOWN + 4) % 4;
        grid[y][x] = { type: T.BULB, rotation: rot, lit: false };
        solution[y][x] = rot;
      } else {
        const type = wireTypeForDirs(uniqueDirs);
        const rot = rotationForDirs(type, uniqueDirs);
        grid[y][x] = { type, rotation: rot, lit: false };
        solution[y][x] = rot;
      }
    }
  }

  // 4. 随机打乱所有非电池、非十字方块的旋转
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      if (!cell) continue;
      if (cell.type === T.BATTERY || cell.type === T.CROSS) continue;
      cell.rotation = (cell.rotation + 1 + Math.floor(Math.random() * 3)) % 4;
    }
  }

  // 5. 确保不是已经解好的状态
  const { totalBulbs, litBulbs } = countBulbs(grid, cols, rows);
  if (litBulbs === totalBulbs && totalBulbs > 0) {
    for (let i = 0; i < 10; i++) {
      const rx = Math.floor(Math.random() * cols);
      const ry = Math.floor(Math.random() * rows);
      const cell = grid[ry][rx];
      if (cell && cell.type !== T.BATTERY && cell.type !== T.CROSS) {
        cell.rotation = (cell.rotation + 1 + Math.floor(Math.random() * 2)) % 4;
      }
    }
  }

  return { grid, solution, batX, batY, tree };
}

function wireTypeForDirs(dirs) {
  const sorted = [...dirs].sort((a, b) => a - b);
  const n = sorted.length;

  if (n >= 4) return T.CROSS;
  if (n === 3) return T.TEE;
  if (n === 2) {
    const [a, b] = sorted;
    return ((b - a + 4) % 4 === 2) ? T.STRAIGHT : T.CURVE;
  }
  return T.STRAIGHT;
}

function rotationForDirs(type, dirs) {
  const sorted = [...dirs].sort((a, b) => a - b);
  const base = BASE_CONNS[type];

  if (type === T.CROSS) return 0;

  if (type === T.TEE) {
    const missing = [0, 1, 2, 3].find(d => !sorted.includes(d));
    return (missing + 1) % 4;
  }

  if (type === T.STRAIGHT) {
    const [a, b] = sorted;
    if ((b - a + 4) % 4 === 2) {
      return a % 2 === 0 ? 0 : 1;
    }
    return 0;
  }

  if (type === T.CURVE) {
    const [a, b] = sorted;
    if (a === 0 && b === 1) return 0;
    if (a === 1 && b === 2) return 1;
    if (a === 2 && b === 3) return 2;
    if (a === 0 && b === 3) return 3;
    return 0;
  }

  return 0;
}

// ======================== 电路连通性检测 ========================

function updateCircuitState() {
  const { grid, cols, rows } = game;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid[y][x].lit = false;
    }
  }

  let batX = -1, batY = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x].type === T.BATTERY) { batX = x; batY = y; }
    }
  }
  if (batX < 0) return;

  grid[batY][batX].lit = true;
  const queue = [{ x: batX, y: batY }];

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const cell = grid[y][x];
    const cellConns = getConns(cell.type, cell.rotation);

    for (const dir of cellConns) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const neighbor = grid[ny][nx];
      if (neighbor.lit) continue;

      const neighborConns = getConns(neighbor.type, neighbor.rotation);
      if (neighborConns.has(OPPOSITE[dir])) {
        neighbor.lit = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  const { totalBulbs, litBulbs } = countBulbs(grid, cols, rows);
  const prevLit = game.litBulbs;
  game.totalBulbs = totalBulbs;
  game.litBulbs = litBulbs;

  if (litBulbs > prevLit) playSound('light');

  if (litBulbs === totalBulbs && totalBulbs > 0 && !game.won) {
    game.won = true;
    onWin();
  }
}

function countBulbs(grid, cols, rows) {
  let total = 0, lit = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x].type === T.BULB) {
        total++;
        if (grid[y][x].lit) lit++;
      }
    }
  }
  return { totalBulbs: total, litBulbs: lit };
}

// ======================== 渲染 ========================

function calculateCellSize() {
  const container = document.getElementById('board-container');
  const { cols, rows } = game;
  const maxW = container.clientWidth - 24;
  const maxH = container.clientHeight - 24;
  const gapSize = 2;
  const padding = 8;

  const availW = maxW - padding * 2 - gapSize * (cols - 1);
  const availH = maxH - padding * 2 - gapSize * (rows - 1);

  game.cellSize = Math.max(28, Math.min(Math.floor(availW / cols), Math.floor(availH / rows), 72));
}

function renderBoard() {
  const board = document.getElementById('board');
  const { cols, rows, cellSize } = game;

  board.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  board.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  board.innerHTML = '';

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = game.grid[y][x];
      const div = document.createElement('div');
      div.className = 'cell' + (cell.lit ? ' lit' : '');
      div.dataset.x = x;
      div.dataset.y = y;

      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cellSize * dpr;
      canvas.height = cellSize * dpr;
      canvas.style.width = cellSize + 'px';
      canvas.style.height = cellSize + 'px';
      canvas._visualRotation = cell.rotation;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      drawTile(ctx, cell, cellSize);

      div.appendChild(canvas);
      div.addEventListener('click', onCellClick);
      div.addEventListener('touchstart', onCellTouch, { passive: false });
      board.appendChild(div);
    }
  }
}

function updateCellDisplay(x, y) {
  const board = document.getElementById('board');
  const i = idx(x, y, game.cols);
  const div = board.children[i];
  if (!div) return;

  const cell = game.grid[y][x];
  const cellSize = game.cellSize;

  div.className = 'cell' + (cell.lit ? ' lit' : '');

  const canvas = div.querySelector('canvas');
  const dpr = window.devicePixelRatio || 1;
  const prevRot = canvas._visualRotation ?? cell.rotation;
  const newRot = cell.rotation;

  if (prevRot !== newRot && !canvas._animating) {
    const angleDelta = ((newRot - prevRot + 4) % 4) * 90;
    canvas._animating = true;
    animatingCount++;
    game.animating = true;
    canvas.style.transform = `rotate(${angleDelta}deg)`;

    setTimeout(() => {
      canvas.style.transition = 'none';
      canvas._visualRotation = newRot;
      canvas.width = cellSize * dpr;
      canvas.height = cellSize * dpr;
      canvas.style.width = cellSize + 'px';
      canvas.style.height = cellSize + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawTile(ctx, cell, cellSize);
      canvas.style.transform = '';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          canvas.style.transition = 'transform 80ms ease-out';
          canvas._animating = false;
          animatingCount--;
          if (animatingCount <= 0) {
            animatingCount = 0;
            game.animating = false;
          }
        });
      });
    }, 90);
  } else if (!canvas._animating) {
    canvas._visualRotation = newRot;
    canvas.width = cellSize * dpr;
    canvas.height = cellSize * dpr;
    canvas.style.width = cellSize + 'px';
    canvas.style.height = cellSize + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawTile(ctx, cell, cellSize);
  }
}

let animatingCount = 0;

// ======================== 绘制 ========================

function drawTile(ctx, cell, size) {
  const lit = cell.lit;
  const wireColor = lit ? '#f5c542' : '#5a6a7a';
  const wireWidth = Math.max(3, size * 0.12);
  const cx = size / 2;
  const cy = size / 2;
  const halfLen = size / 2 - size * 0.08;

  const conns = getConns(cell.type, cell.rotation);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (cell.type === T.BATTERY) {
    drawBattery(ctx, cx, cy, size, lit, wireColor, wireWidth, halfLen, cell.rotation);
  } else if (cell.type === T.BULB) {
    drawBulb(ctx, cx, cy, size, lit, conns, wireColor, wireWidth, halfLen, cell.rotation);
  } else {
    drawWire(ctx, cx, cy, size, lit, conns, wireColor, wireWidth, halfLen);
  }
}

function drawWire(ctx, cx, cy, size, lit, conns, wireColor, wireWidth, halfLen) {
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = wireWidth;

  if (lit) {
    ctx.shadowColor = '#f5c542';
    ctx.shadowBlur = 10;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  for (const dir of conns) {
    let ex, ey;
    switch (dir) {
      case DIR_UP:    ex = cx; ey = cy - halfLen; break;
      case DIR_RIGHT: ex = cx + halfLen; ey = cy; break;
      case DIR_DOWN:  ex = cx; ey = cy + halfLen; break;
      case DIR_LEFT:  ex = cx - halfLen; ey = cy; break;
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
}

function drawBulb(ctx, cx, cy, size, lit, conns, wireColor, wireWidth, halfLen, rotation) {
  const bulbRadius = size * 0.22;

  const inputDir = [...conns][0];
  let ex, ey;
  switch (inputDir) {
    case DIR_UP:    ex = cx; ey = cy - halfLen; break;
    case DIR_RIGHT: ex = cx + halfLen; ey = cy; break;
    case DIR_DOWN:  ex = cx; ey = cy + halfLen; break;
    case DIR_LEFT:  ex = cx - halfLen; ey = cy; break;
  }

  ctx.strokeStyle = wireColor;
  ctx.lineWidth = wireWidth;
  ctx.shadowColor = lit ? '#f5c542' : 'transparent';
  ctx.shadowBlur = lit ? 8 : 0;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.shadowBlur = lit ? 18 : 0;
  ctx.shadowColor = lit ? '#f5c542' : 'transparent';

  ctx.fillStyle = lit ? '#f5c542' : '#555';
  ctx.strokeStyle = lit ? '#d4a017' : '#444';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, bulbRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const bulbRot = rotation * Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bulbRot);
  ctx.translate(-cx, -cy);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = lit ? '#fff8dc' : '#666';
  ctx.lineWidth = 1.5;

  const fH = bulbRadius * 0.5;
  const fW = bulbRadius * 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - fW, cy - bulbRadius * 0.1);
  ctx.lineTo(cx - fW / 2, cy + bulbRadius * 0.35);
  ctx.lineTo(cx, cy - bulbRadius * 0.1);
  ctx.lineTo(cx + fW / 2, cy + bulbRadius * 0.35);
  ctx.lineTo(cx + fW, cy - bulbRadius * 0.1);
  ctx.stroke();

  const baseW = bulbRadius * 0.6;
  const baseTop = cy + bulbRadius * 0.4;
  ctx.strokeStyle = lit ? '#c4a020' : '#444';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const by = baseTop + i * 4;
    ctx.beginPath();
    ctx.moveTo(cx - baseW, by);
    ctx.lineTo(cx + baseW, by);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBattery(ctx, cx, cy, size, lit, wireColor, wireWidth, halfLen, rotation) {
  const batRot = rotation * Math.PI / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(batRot);
  ctx.translate(-cx, -cy);

  const batW = size * 0.38;
  const batH = size * 0.6;
  const capH = size * 0.08;

  const outColor = lit ? '#f5c542' : '#5a6a7a';
  ctx.strokeStyle = outColor;
  ctx.lineWidth = wireWidth;
  ctx.shadowColor = lit ? '#f5c542' : 'transparent';
  ctx.shadowBlur = lit ? 8 : 0;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - halfLen);
  ctx.stroke();

  ctx.shadowBlur = lit ? 12 : 0;
  ctx.shadowColor = lit ? '#f5c542' : 'transparent';

  const bodyColor = lit ? '#7a9e6e' : '#6a7e6a';
  const bodyBorder = lit ? '#5d8a52' : '#556655';
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = bodyBorder;
  ctx.lineWidth = 2;

  const rx = cx - batW / 2;
  const ry = cy - batH / 2 + capH;
  const cornerR = 4;
  ctx.beginPath();
  ctx.roundRect(rx, ry, batW, batH, cornerR);
  ctx.fill();
  ctx.stroke();

  const capW = batW * 0.45;
  ctx.fillStyle = lit ? '#d0d0d0' : '#999';
  ctx.strokeStyle = lit ? '#b8b8b8' : '#777';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - capW / 2, ry - capH, capW, capH + 2, [3, 3, 0, 0]);
  ctx.fill();
  ctx.stroke();

  const lightningSize = size * 0.15;
  ctx.fillStyle = lit ? '#fffbe6' : '#ccc';
  drawLightningBolt(ctx, cx, cy + capH * 0.5, lightningSize, lit);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawLightningBolt(ctx, cx, cy, size, lit) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, -s);
  ctx.lineTo(-s * 0.35, s * 0.05);
  ctx.lineTo(s * 0.0, s * 0.05);
  ctx.lineTo(-s * 0.15, s);
  ctx.lineTo(s * 0.35, -s * 0.05);
  ctx.lineTo(s * 0.0, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ======================== 交互 ========================

function onCellClick(e) {
  if (game.paused || game.won || game.animating) return;
  const x = parseInt(e.currentTarget.dataset.x);
  const y = parseInt(e.currentTarget.dataset.y);
  rotateCell(x, y);
}

function onCellTouch(e) {
  if (game.paused || game.won || game.animating) return;
  e.preventDefault();
  const x = parseInt(e.currentTarget.dataset.x);
  const y = parseInt(e.currentTarget.dataset.y);
  rotateCell(x, y);
}

function rotateCell(x, y) {
  const cell = game.grid[y][x];
  if (!cell || cell.type === T.BATTERY || cell.type === T.CROSS) return;

  cell.rotation = (cell.rotation + 1) % 4;
  playSound('rotate');

  updateCircuitState();
  updateAllCells();
  updateBulbIndicator();
}

function updateAllCells() {
  for (let y = 0; y < game.rows; y++) {
    for (let x = 0; x < game.cols; x++) {
      updateCellDisplay(x, y);
    }
  }
}

// ======================== 计时器 ========================

function startTimer() {
  stopTimer();
  game.timer = 0;
  updateTimerDisplay();
  game.timerInterval = setInterval(() => {
    if (!game.paused && !game.won) {
      game.timer++;
      updateTimerDisplay();
    }
  }, 1000);
}

function stopTimer() {
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = Math.floor(game.timer / 60).toString().padStart(2, '0');
  const s = (game.timer % 60).toString().padStart(2, '0');
  document.getElementById('timer-display').textContent = m + ':' + s;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// ======================== 最佳记录 ========================

function getBestRecord(difficulty) {
  try {
    const val = localStorage.getItem('circuit_best_' + difficulty);
    return val ? parseInt(val) : null;
  } catch { return null; }
}

function setBestRecord(difficulty, seconds) {
  try {
    localStorage.setItem('circuit_best_' + difficulty, seconds);
  } catch {}
}

function updateBestDisplay() {
  const best = getBestRecord(game.difficulty);
  document.getElementById('best-display').textContent = best ? formatTime(best) : '--:--';
}

// ======================== 灯泡指示器 ========================

function updateBulbIndicator() {
  const container = document.getElementById('bulb-indicator');
  container.innerHTML =
    '<span style="color:var(--glow-color);font-weight:bold">' + game.litBulbs + '</span>/' +
    '<span>' + game.totalBulbs + '</span>';
}

// ======================== 游戏控制 ========================

function startGame(difficulty) {
  game.difficulty = difficulty;
  const config = DIFFICULTY[difficulty];
  game.cols = config.cols;
  game.rows = config.rows;
  game.won = false;
  game.paused = false;

  document.getElementById('game-screen').style.display = 'flex';

  generateAndRender();
  updateBestDisplay();
  startTimer();
}

function generateAndRender() {
  const { cols, rows } = game;
  const result = generatePuzzle(cols, rows);
  game.grid = result.grid;
  game.solution = result.solution;
  game.tree = result.tree;
  game.batX = result.batX;
  game.batY = result.batY;
  game.solving = false;
  animatingCount = 0;
  game.animating = false;

  updateCircuitState();
  calculateCellSize();
  renderBoard();
  updateBulbIndicator();
}

function resetPuzzle() {
  if (game.won) return;
  playSound('click');
  game.won = false;
  game.paused = false;
  game.solving = false;
  if (solveTimeout) { clearTimeout(solveTimeout); solveTimeout = null; }
  document.getElementById('pause-overlay').style.display = 'none';
  document.getElementById('btn-hint').style.opacity = '1';
  generateAndRender();
  game.timer = 0;
  updateTimerDisplay();
}

function togglePause() {
  if (game.won) return;
  game.paused = !game.paused;
  playSound('click');
  const overlay = document.getElementById('pause-overlay');
  overlay.style.display = game.paused ? 'flex' : 'none';
  document.getElementById('btn-pause').textContent = game.paused ? '\u25B6' : '\u23F8';

  if (game.paused && game.solving) {
    game.solving = false;
    if (solveTimeout) { clearTimeout(solveTimeout); solveTimeout = null; }
    document.getElementById('btn-hint').style.opacity = '1';
  }
}

// 监听父页面音乐开关同步
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'syncSound') {
    game.soundOn = !!e.data.on;
  }
});

function backToMenu() {
  stopTimer();
  game.paused = false;
  game.won = false;
  game.solving = false;
  if (solveTimeout) { clearTimeout(solveTimeout); solveTimeout = null; }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'backToMenu' }, '*');
  } else {
    location.href = '../../index.html';
  }
}

// ======================== 提示/自动还原 ========================

let solveTimeout = null;

function startSolve() {
  if (game.won || game.solving) return;
  game.solving = true;
  game.paused = true;

  document.getElementById('btn-hint').style.opacity = '0.4';

  // DFS 遍历电路树，按从根（电池）开始的深度优先顺序收集需要旋转的方块
  const targets = [];
  const tree = game.tree;
  const stack = [{ x: game.batX, y: game.batY }];
  const visited = Array.from({ length: game.rows }, () => new Uint8Array(game.cols));
  visited[game.batY][game.batX] = 1;

  while (stack.length > 0) {
    const { x, y } = stack.pop();
    const cell = game.grid[y][x];
    if (cell && cell.type !== T.BATTERY && cell.type !== T.CROSS) {
      if (cell.rotation !== game.solution[y][x]) {
        targets.push({ x, y });
      }
    }
    // 按 children 顺序压栈（反序压入以保证第一个 child 先处理）
    const children = tree[y][x].children;
    for (let i = children.length - 1; i >= 0; i--) {
      const d = children[i];
      const nx = x + DX[d], ny = y + DY[d];
      if (nx >= 0 && nx < game.cols && ny >= 0 && ny < game.rows && !visited[ny][nx]) {
        visited[ny][nx] = 1;
        stack.push({ x: nx, y: ny });
      }
    }
  }

  if (targets.length === 0) {
    game.solving = false;
    game.paused = false;
    document.getElementById('btn-hint').style.opacity = '1';
    return;
  }

  let index = 0;
  function solveNext() {
    if (index >= targets.length || !game.solving) {
      game.solving = false;
      game.paused = false;
      document.getElementById('btn-hint').style.opacity = '1';
      return;
    }

    const { x, y } = targets[index];
    const cell = game.grid[y][x];
    const solRot = game.solution[y][x];

    if (cell && cell.rotation !== solRot) {
      cell.rotation = solRot;
      playSound('rotate');
      updateCircuitState();
      updateAllCells();
      updateBulbIndicator();

      if (game.won) {
        game.solving = false;
        game.paused = false;
        document.getElementById('btn-hint').style.opacity = '1';
        return;
      }
    }

    index++;
    solveTimeout = setTimeout(solveNext, 120);
  }

  solveNext();
}

function onWin() {
  stopTimer();
  playSound('win');

  game.solving = false;
  if (solveTimeout) { clearTimeout(solveTimeout); solveTimeout = null; }
  document.getElementById('btn-hint').style.opacity = '1';

  const best = getBestRecord(game.difficulty);
  const isNewRecord = !best || game.timer < best;
  if (isNewRecord) {
    setBestRecord(game.difficulty, game.timer);
  }

  setTimeout(() => {
    document.getElementById('win-time').textContent = '用时：' + formatTime(game.timer);
    document.getElementById('win-record').style.display = isNewRecord ? 'block' : 'none';
    document.getElementById('win-bar').style.display = 'block';
    document.getElementById('win-return-bar').style.display = 'block';
    document.getElementById('control-bar').style.display = 'none';
  }, 300);
}

// ======================== 窗口大小变化 ========================

let resizeTimeout = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('game-screen').style.display !== 'none') {
      calculateCellSize();
      renderBoard();
    }
  }, 200);
});

document.addEventListener('dblclick', e => e.preventDefault());

// ======================== 从 URL 参数自动开始游戏 ========================
(function autoStart() {
  const params = new URLSearchParams(location.search);
  const d = params.get('d');
  if (d && DIFFICULTY[d]) {
    startGame(d);
  }
})();
