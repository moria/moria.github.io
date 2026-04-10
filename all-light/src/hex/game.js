// ======================== 六边形背景灰色池 ========================
const HEX_BG_COLORS = [
  'rgba(58, 48, 68, 0.9)',
  'rgba(64, 54, 74, 0.9)',
  'rgba(70, 60, 80, 0.9)',
  'rgba(76, 66, 86, 0.9)',
  'rgba(82, 72, 92, 0.9)',
];

// ======================== 方向系统 (6方向, 平顶六边形) ========================
// 平顶六边形的6条边的中点方向（从圆心向边中点）：
//   N(270°), NE(330°), SE(30°), S(90°), SW(150°), NW(210°)
// 注意：同一行内相邻六边形不共享边（间距3r），实际邻居在相邻行(±1)和跨行(±2)
//
// 交错行布局（0-indexed）：
//   偶数行(0,2,4...): 5列, 向右偏移1.5r
//   奇数行(1,3,5...): 6列, 无偏移
// 视觉上偶数行嵌套在奇数行之间，保持网格对称。

const NUM_DIRS = 6;
const DIR_N = 0, DIR_NE = 1, DIR_SE = 2, DIR_S = 3, DIR_SW = 4, DIR_NW = 5;

// 邻居偏移量 [dc, dr]，dc=列偏移, dr=行偏移
// 非偏移行（6列行）的邻居
const NEIGHBOR_UNSHIFTED = [
  [0, -2],   // N:  同列, 上2行
  [0, -1],   // NE: 同列, 上1行 (偏移行自带右偏)
  [0, +1],   // SE: 同列, 下1行
  [0, +2],   // S:  同列, 下2行
  [-1, +1],  // SW: 左1列, 下1行
  [-1, -1],  // NW: 左1列, 上1行
];
// 偏移行（5列行，向右偏移1.5r）的邻居
const NEIGHBOR_SHIFTED = [
  [0, -2],   // N:  同列, 上2行
  [+1, -1],  // NE: 右1列, 上1行
  [+1, +1],  // SE: 右1列, 下1行
  [0, +2],   // S:  同列, 下2行
  [0, +1],   // SW: 同列, 下1行
  [0, -1],   // NW: 同列, 上1行
];

const OPPOSITE = [3, 4, 5, 0, 1, 2]; // N↔S, NE↔SW, SE↔NW

// 平顶六边形边中点角度（弧度）
const DIR_ANGLE = [
  3 * Math.PI / 2,      // N:  270°
  11 * Math.PI / 6,     // NE: 330°
  Math.PI / 6,          // SE: 30°
  Math.PI / 2,          // S:  90°
  5 * Math.PI / 6,      // SW: 150°
  7 * Math.PI / 6,      // NW: 210°
];

// 0-indexed偶数行偏移，奇数行不偏移
function getNeighborOffset(row) {
  return row % 2 === 0 ? NEIGHBOR_SHIFTED : NEIGHBOR_UNSHIFTED;
}

// 每行列数：偶数行 smallCols 列（偏移行），奇数行 largeCols 列（非偏移行）
function colsForRow(r) {
  return r % 2 === 0 ? game.smallCols : game.largeCols;
}

// ======================== 方块类型 ========================
const T = {
  LINE:    'LINE',     // 直线: 2个对向开口 (diff=3, 180°)
  CURVE:   'CURVE',    // 弯道: 2个相邻开口 (diff=1, 60°)
  ANGLE:   'ANGLE',    // 钝角: 2个跳一开口 (diff=2, 120°)
  TEE:     'TEE',      // T型: 3个连续方向 [0,1,2]
  FAN:     'FAN',      // 扇型: 3个非连续方向 [0,1,3] gap升序[1,2,3]
  FAN2:    'FAN2',     // 扇型2: 3个非连续方向 [0,1,4] gap降序[1,3,2]
  Y:       'Y',        // Y型: 3个均匀方向 [0,2,4]
  CORNER:  'CORNER',   // 拐角: 4个连续方向 [0,1,2,3]
  CROSS4:  'CROSS4',   // 交叉4: 4个非连续方向 [0,1,2,4] gap[1,1,2,2]
  PAIRS4:  'PAIRS4',   // 对称4: 4个方向交替 [0,1,3,4] gap[1,2,1,2]
  FILL5:   'FILL5',    // 五连: 5个方向
  FILL6:   'FILL6',    // 六连: 全方向, 不可旋转
  BULB:    'BULB',     // 灯泡: 1个输入口
  BATTERY: 'BATTERY',  // 电池: 1个输出口, 不可旋转
};

// 基础开口方向 (rotation=0 时)
const BASE_CONNS = {
  [T.LINE]:    [DIR_N, DIR_S],                              // [0,3] 对向
  [T.CURVE]:   [DIR_N, DIR_NE],                             // [0,1] 相邻
  [T.ANGLE]:   [DIR_N, DIR_SE],                             // [0,2] 跳一
  [T.TEE]:     [DIR_N, DIR_NE, DIR_SE],                     // [0,1,2] 连续3
  [T.FAN]:     [DIR_N, DIR_NE, DIR_S],                      // [0,1,3] 扇型
  [T.FAN2]:    [DIR_N, DIR_NE, DIR_SW],                     // [0,1,4] 扇型2
  [T.Y]:       [DIR_N, DIR_SE, DIR_SW],                     // [0,2,4] 均匀
  [T.CORNER]:  [DIR_N, DIR_NE, DIR_SE, DIR_S],              // [0,1,2,3] 连续4
  [T.CROSS4]:  [DIR_N, DIR_NE, DIR_SE, DIR_SW],             // [0,1,2,4] 交叉4
  [T.PAIRS4]:  [DIR_N, DIR_NE, DIR_S, DIR_SW],              // [0,1,3,4] 对称4
  [T.FILL5]:   [DIR_N, DIR_NE, DIR_SE, DIR_S, DIR_SW],      // 5个
  [T.FILL6]:   [DIR_N, DIR_NE, DIR_SE, DIR_S, DIR_SW, DIR_NW], // 全部
  [T.BULB]:    [DIR_S],                                     // 输入口朝下
  [T.BATTERY]: [DIR_N],                                     // 输出口朝上
};

// ======================== 难度配置 ========================
const HEX_DIFFICULTY = {
  hell1: { smallCols: 1, largeCols: 2, rows: 7 },
  hell2: { smallCols: 3, largeCols: 4, rows: 17 },
  hell3: { smallCols: 5, largeCols: 6, rows: 25 },
};

// ======================== 游戏状态 ========================
let game = {
  rows: 0,
  smallCols: 5,
  largeCols: 6,
  grid: [],
  solution: [],
  difficulty: '',
  timer: 0,
  timerInterval: null,
  paused: false,
  soundOn: localStorage.getItem('bgm_on') !== '0',
  totalBulbs: 0,
  litBulbs: 0,
  hexSize: 40, // r = 边长
  won: false,
  solving: false,
  animating: false,
};

let animatingCount = 0;
let solveTimeout = null;

// ======================== 音效系统 ========================
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
        break;
      case 'light':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
        break;
      case 'win': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
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
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
        break;
    }
  } catch (e) {}
}

// ======================== 辅助函数 ========================

function getConns(type, rotation) {
  return new Set(BASE_CONNS[type].map(d => (d + rotation) % NUM_DIRS));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ======================== 关卡生成 (DFS 生成树) ========================

function generateHexPuzzle(rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    const cols = colsForRow(r);
    for (let c = 0; c < cols; c++) {
      grid[r][c] = null;
    }
  }

  // 1. 放置电池在底部中间
  const batRow = rows - 1;
  const batCol = Math.floor(colsForRow(batRow) / 2);
  grid[batRow][batCol] = { type: T.BATTERY, rotation: 0, lit: false };

  // 2. DFS 生成覆盖所有格子的生成树
  const visited = Array.from({ length: rows }, (_, r) => new Uint8Array(colsForRow(r)));
  const tree = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: colsForRow(r) }, () => ({ parentDir: -1, children: [] }))
  );

  visited[batRow][batCol] = 1;

  // 电池输出方向 DIR_N (向上)，连接到 N 邻居
  const off = getNeighborOffset(batRow);
  const batDir = DIR_N; // 电池基础输出方向
  const firstCol = batCol + off[batDir][0];
  const firstRow = batRow + off[batDir][1];

  if (firstRow >= 0 && firstRow < rows && firstCol >= 0 && firstCol < colsForRow(firstRow)) {
    visited[firstRow][firstCol] = 1;
    tree[batRow][batCol].children.push(batDir);
    tree[firstRow][firstCol].parentDir = OPPOSITE[batDir];
  }

  // 标准随机 DFS
  const dfsStack = [{ col: firstCol, row: firstRow }];

  while (dfsStack.length > 0) {
    const top = dfsStack[dfsStack.length - 1];
    const noff = getNeighborOffset(top.row);
    const neighbors = [];
    for (let d = 0; d < NUM_DIRS; d++) {
      const nc = top.col + noff[d][0];
      const nr = top.row + noff[d][1];
      if (nc >= 0 && nc < colsForRow(nr) && nr >= 0 && nr < rows && !visited[nr][nc]) {
        neighbors.push({ d, nc, nr });
      }
    }
    if (neighbors.length === 0) {
      dfsStack.pop();
      continue;
    }
    const { d, nc, nr } = neighbors[Math.floor(Math.random() * neighbors.length)];
    visited[nr][nc] = 1;
    tree[top.row][top.col].children.push(d);
    tree[nr][nc].parentDir = OPPOSITE[d];
    dfsStack.push({ col: nc, row: nr });
  }

  // 3. 根据生成树确定每个格子的类型和正确旋转
  const solution = [];
  for (let r = 0; r < rows; r++) {
    solution[r] = [];
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      if (c === batCol && r === batRow) {
        const batChild = tree[r][c].children[0];
        const batRot = (batChild - DIR_N + NUM_DIRS) % NUM_DIRS;
        grid[r][c].rotation = batRot;
        solution[r][c] = batRot;
        continue;
      }

      const node = tree[r][c];
      const dirs = [...node.children];
      if (node.parentDir >= 0) dirs.push(node.parentDir);
      if (dirs.length === 0) dirs.push(DIR_N);

      if (dirs.length === 1) {
        // 叶子节点 = 灯泡
        const inputDir = dirs[0];
        const rot = (inputDir - DIR_S + NUM_DIRS) % NUM_DIRS;
        grid[r][c] = { type: T.BULB, rotation: rot, lit: false, bgColor: HEX_BG_COLORS[Math.floor(Math.random() * HEX_BG_COLORS.length)] };
        solution[r][c] = rot;
      } else {
        // 内部节点 = 电线
        const type = wireTypeForDirsHex(dirs);
        const rot = rotationForDirsHex(type, dirs);
        grid[r][c] = { type, rotation: rot, lit: false, bgColor: HEX_BG_COLORS[Math.floor(Math.random() * HEX_BG_COLORS.length)] };
        solution[r][c] = rot;
      }
    }
  }

  // 4. 验证解的正确性（debug保障）
  if (!verifySolution(grid, solution, rows)) {
    console.warn('Solution verification failed, regenerating...');
    return generateHexPuzzle(rows);
  }

  // 5. 随机打乱所有非电池、非FILL6方块的旋转
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      if (cell.type === T.BATTERY || cell.type === T.FILL6) continue;
      cell.rotation = (cell.rotation + 1 + Math.floor(Math.random() * 5)) % NUM_DIRS;
    }
  }

  // 6. 确保不是已解状态
  const { totalBulbs, litBulbs } = countBulbsFromGrid(grid, rows);
  if (litBulbs === totalBulbs && totalBulbs > 0) {
    for (let i = 0; i < 15; i++) {
      const rr = Math.floor(Math.random() * rows);
      const rc = Math.floor(Math.random() * colsForRow(rr));
      const cell = grid[rr][rc];
      if (cell && cell.type !== T.BATTERY && cell.type !== T.FILL6) {
        cell.rotation = (cell.rotation + 1 + Math.floor(Math.random() * 3)) % NUM_DIRS;
      }
    }
  }

  return { grid, solution, batCol, batRow, tree };
}

function wireTypeForDirsHex(dirs) {
  const n = dirs.length;
  const sorted = [...dirs].sort((a, b) => a - b);
  if (n >= 6) return T.FILL6;
  if (n === 5) return T.FILL5;
  if (n === 4) {
    // 计算循环间距判断类型
    const gaps = [];
    for (let i = 0; i < n; i++) {
      gaps.push((sorted[(i + 1) % n] - sorted[i] + NUM_DIRS) % NUM_DIRS);
    }
    // CORNER: 4个连续方向, 有一个gap=3
    if (gaps.includes(3)) return T.CORNER;
    // PAIRS4: gap交替 [1,2,1,2] or [2,1,2,1]
    if (gaps[0] !== gaps[1] && gaps[1] !== gaps[2] && gaps[2] !== gaps[3]) return T.PAIRS4;
    // CROSS4: 其余 gap[1,1,2,2]
    return T.CROSS4;
  }
  if (n === 3) {
    const gaps = [];
    for (let i = 0; i < n; i++) {
      gaps.push((sorted[(i + 1) % n] - sorted[i] + NUM_DIRS) % NUM_DIRS);
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    // Y: [2,2,2]; TEE: 含gap=4即[1,1,4]
    if (sortedGaps[0] === 2 && sortedGaps[1] === 2 && sortedGaps[2] === 2) return T.Y;
    if (sortedGaps[2] === 4) return T.TEE;
    // FAN vs FAN2: 都是gap多集{1,2,3}，通过gap=1后的下一个gap区分
    const pos1 = gaps.indexOf(1);
    const nextGap = gaps[(pos1 + 1) % 3];
    return nextGap === 2 ? T.FAN : T.FAN2;
  }
  if (n === 2) {
    const diff = (sorted[1] - sorted[0] + NUM_DIRS) % NUM_DIRS;
    const minDiff = Math.min(diff, NUM_DIRS - diff);
    if (minDiff === 3) return T.LINE;   // 180°
    if (minDiff === 1) return T.CURVE;  // 60°
    return T.ANGLE;                     // 120°
  }
  return T.LINE;
}

function rotationForDirsHex(type, dirs) {
  const sorted = [...dirs].sort((a, b) => a - b);
  const base = BASE_CONNS[type];
  if (type === T.FILL6) return 0;

  for (let rot = 0; rot < NUM_DIRS; rot++) {
    const rotated = base.map(d => (d + rot) % NUM_DIRS).sort((a, b) => a - b);
    if (rotated.length === sorted.length && rotated.every((v, i) => v === sorted[i])) {
      return rot;
    }
  }
  return 0;
}

// ======================== 解验证 ========================

function verifySolution(grid, solution, rows) {
  // 临时将所有cell设为solution旋转，检查是否全连通
  const savedRotations = [];
  for (let r = 0; r < rows; r++) {
    savedRotations[r] = [];
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      savedRotations[r][c] = grid[r][c].rotation;
      grid[r][c].rotation = solution[r][c];
    }
  }

  // BFS从电池出发
  let batCol = -1, batRow = -1;
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      if (grid[r][c].type === T.BATTERY) { batCol = c; batRow = r; }
    }
  }

  const visited = Array.from({ length: rows }, (_, r) => new Uint8Array(colsForRow(r)));
  visited[batRow][batCol] = 1;
  const queue = [{ col: batCol, row: batRow }];
  let reachable = 1;

  while (queue.length > 0) {
    const { col, row } = queue.shift();
    const cell = grid[row][col];
    const cellConns = getConns(cell.type, cell.rotation);
    const off = getNeighborOffset(row);

    for (const dir of cellConns) {
      const nc = col + off[dir][0];
      const nr = row + off[dir][1];
      if (nc < 0 || nc >= colsForRow(nr) || nr < 0 || nr >= rows) continue;
      if (visited[nr][nc]) continue;
      const neighbor = grid[nr][nc];
      const neighborConns = getConns(neighbor.type, neighbor.rotation);
      if (neighborConns.has(OPPOSITE[dir])) {
        visited[nr][nc] = 1;
        reachable++;
        queue.push({ col: nc, row: nr });
      }
    }
  }

  // 恢复原旋转
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      grid[r][c].rotation = savedRotations[r][c];
    }
  }

  let totalCells = 0;
  for (let r = 0; r < rows; r++) totalCells += colsForRow(r);
  return reachable === totalCells;
}

// ======================== 电路连通性检测 (BFS) ========================

function updateCircuitState() {
  const { grid, rows } = game;

  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      grid[r][c].lit = false;
    }
  }

  // 找到电池
  let batCol = -1, batRow = -1;
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      if (grid[r][c].type === T.BATTERY) { batCol = c; batRow = r; }
    }
  }
  if (batCol < 0) return;

  grid[batRow][batCol].lit = true;
  const queue = [{ col: batCol, row: batRow }];

  while (queue.length > 0) {
    const { col, row } = queue.shift();
    const cell = grid[row][col];
    const cellConns = getConns(cell.type, cell.rotation);
    const off = getNeighborOffset(row);

    for (const dir of cellConns) {
      const nc = col + off[dir][0];
      const nr = row + off[dir][1];
      if (nc < 0 || nc >= colsForRow(nr) || nr < 0 || nr >= rows) continue;
      const neighbor = grid[nr][nc];
      if (neighbor.lit) continue;

      const neighborConns = getConns(neighbor.type, neighbor.rotation);
      if (neighborConns.has(OPPOSITE[dir])) {
        neighbor.lit = true;
        queue.push({ col: nc, row: nr });
      }
    }
  }

  const { totalBulbs, litBulbs } = countBulbsFromGrid(grid, rows);
  const prevLit = game.litBulbs;
  game.totalBulbs = totalBulbs;
  game.litBulbs = litBulbs;

  if (litBulbs > prevLit) playSound('light');

  if (litBulbs === totalBulbs && totalBulbs > 0 && !game.won) {
    game.won = true;
    onWin();
  }
}

function countBulbsFromGrid(grid, rows) {
  let total = 0, lit = 0;
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      if (grid[r][c].type === T.BULB) {
        total++;
        if (grid[r][c].lit) lit++;
      }
    }
  }
  return { totalBulbs: total, litBulbs: lit };
}

// ======================== 渲染 ========================

function calculateHexSize() {
  const container = document.getElementById('board-container');
  const { rows } = game;

  // 平顶六边形几何参数 (边长 = r)
  // 六边形宽度: 2r, 六边形高度: √3 * r
  // 列间距: 3r, 行间距: √3/2 * r
  // 最大列6列（奇数行，无偏移）：总宽 = (6-1)*3r + 2r = 17r
  const SQRT3 = Math.sqrt(3);
  const padding = 16;
  const maxW = container.clientWidth - padding * 2;
  const maxH = container.clientHeight - padding * 2;

  // 最大列数（奇数行，无偏移）
  const maxCols = game.largeCols;
  const wFactor = 3 * (maxCols - 1) + 2;
  const hFactor = SQRT3 / 2 * (rows - 1) + SQRT3;

  game.hexSize = Math.max(16, Math.min(Math.floor(maxW / wFactor), Math.floor(maxH / hFactor), 48));
}

function renderBoard() {
  const board = document.getElementById('board');
  const { rows, hexSize } = game;

  const SQRT3 = Math.sqrt(3);
  const r = hexSize;
  const colSpacing = 3 * r;
  const rowSpacing = SQRT3 / 2 * r;
  const hexWidth = 2 * r;
  const hexHeight = SQRT3 * r;

  // board尺寸基于最宽行
  const maxCols = game.largeCols;
  const boardW = colSpacing * (maxCols - 1) + hexWidth;
  const boardH = rowSpacing * (rows - 1) + hexHeight;

  board.style.width = boardW + 'px';
  board.style.height = boardH + 'px';
  board.innerHTML = '';

  for (let row = 0; row < rows; row++) {
    const rowCols = colsForRow(row);
    for (let col = 0; col < rowCols; col++) {
      const cell = game.grid[row][col];
      // 偶数行(5列)向右偏移1.5r，奇数行(6列)无偏移
      const offsetX = row % 2 === 0 ? colSpacing / 2 : 0;
      const posX = col * colSpacing + offsetX;
      const posY = row * rowSpacing;

      const div = document.createElement('div');
      div.className = 'hex-cell' + (cell.lit ? ' lit' : '');
      div.dataset.col = col;
      div.dataset.row = row;
      div.style.left = posX + 'px';
      div.style.top = posY + 'px';
      div.style.width = hexWidth + 'px';
      div.style.height = hexHeight + 'px';

      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = hexWidth * dpr;
      canvas.height = hexHeight * dpr;
      canvas.style.width = hexWidth + 'px';
      canvas.style.height = hexHeight + 'px';
      canvas._visualRotation = cell.rotation;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      drawHexTile(ctx, cell, r);

      div.appendChild(canvas);
      div.addEventListener('click', onCellClick);
      div.addEventListener('touchstart', onCellTouch, { passive: false });
      board.appendChild(div);
    }
  }
}

function updateCellDisplay(col, row) {
  const board = document.getElementById('board');
  const cellDivs = board.querySelectorAll('.hex-cell');
  let div = null;
  for (const d of cellDivs) {
    if (parseInt(d.dataset.col) === col && parseInt(d.dataset.row) === row) {
      div = d; break;
    }
  }
  if (!div) return;

  const cell = game.grid[row][col];
  const r = game.hexSize;
  const hexWidth = 2 * r;
  const hexHeight = Math.sqrt(3) * r;

  div.className = 'hex-cell' + (cell.lit ? ' lit' : '');

  const canvas = div.querySelector('canvas');
  const dpr = window.devicePixelRatio || 1;
  const prevRot = canvas._visualRotation ?? cell.rotation;
  const newRot = cell.rotation;

  if (prevRot !== newRot && !canvas._animating) {
    const angleDelta = ((newRot - prevRot + NUM_DIRS) % NUM_DIRS) * 60;
    const duration = 80;
    canvas._animating = true;
    animatingCount++;
    game.animating = true;
    canvas.style.transition = `transform ${duration}ms ease-out`;
    canvas.style.transform = `rotate(${angleDelta}deg)`;

    setTimeout(() => {
      canvas.style.transition = 'none';
      canvas._visualRotation = newRot;
      canvas.width = hexWidth * dpr;
      canvas.height = hexHeight * dpr;
      canvas.style.width = hexWidth + 'px';
      canvas.style.height = hexHeight + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawHexTile(ctx, cell, r);
      canvas.style.transform = '';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          canvas.style.transition = `transform 80ms ease-out`;
          canvas._animating = false;
          animatingCount--;
          if (animatingCount <= 0) {
            animatingCount = 0;
            game.animating = false;
          }
        });
      });
    }, duration + 10);
  } else if (!canvas._animating) {
    canvas._visualRotation = newRot;
    canvas.width = hexWidth * dpr;
    canvas.height = hexHeight * dpr;
    canvas.style.width = hexWidth + 'px';
    canvas.style.height = hexHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawHexTile(ctx, cell, r);
  }
}

function updateAllCells() {
  for (let r = 0; r < game.rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      updateCellDisplay(c, r);
    }
  }
}

// ======================== 绘制 ========================

function drawHexTile(ctx, cell, r) {
  const lit = cell.lit;
  const wireColor = lit ? '#b388ff' : '#6a5a8a';
  const wireWidth = Math.max(2, r * 0.12); // 电线宽度提高50%
  // 六边形中心在 canvas 内的位置: (r, √3/2 * r)
  const cx = r;
  const cy = r * Math.sqrt(3) / 2;

  const conns = getConns(cell.type, cell.rotation);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 绘制六边形背景
  drawHexagon(ctx, cx, cy, r * 0.92,
    lit ? 'transparent' : (cell.bgColor || 'rgba(70, 60, 80, 0.9)'),
    lit ? 'rgba(179, 136, 255, 0.3)' : 'rgba(106, 90, 138, 0.4)',
    1.5);

  if (cell.type === T.BATTERY) {
    drawHexBattery(ctx, cx, cy, r, lit, wireColor, wireWidth, cell.rotation);
  } else if (cell.type === T.BULB) {
    drawHexBulb(ctx, cx, cy, r, lit, conns, wireColor, wireWidth);
  } else {
    drawHexWire(ctx, cx, cy, r, lit, conns, wireColor, wireWidth);
  }
}

function drawHexagon(ctx, cx, cy, r, fill, stroke, strokeWidth) {
  // 平顶六边形顶点角度: 0°, 60°, 120°, 180°, 240°, 300°
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i; // 从0°开始，每60°一个顶点
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}

function drawHexWire(ctx, cx, cy, r, lit, conns, wireColor, wireWidth) {
  const edgeDist = r * 0.82;

  ctx.strokeStyle = wireColor;
  ctx.lineWidth = wireWidth;

  if (lit) {
    ctx.shadowColor = '#b388ff';
    ctx.shadowBlur = 8;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // 从中心向边中点画线
  for (const dir of conns) {
    const angle = DIR_ANGLE[dir];
    const ex = cx + edgeDist * Math.cos(angle);
    const ey = cy + edgeDist * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // 中心圆点
  ctx.shadowBlur = 0;
  ctx.fillStyle = wireColor;
  ctx.beginPath();
  ctx.arc(cx, cy, wireWidth * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawHexBulb(ctx, cx, cy, r, lit, conns, wireColor, wireWidth) {
  const bulbRadius = r * 0.42;  // 灯泡总体增大50%
  const edgeDist = r * 0.82;
  const inputDir = [...conns][0];
  const inputAngle = DIR_ANGLE[inputDir];

  // 输入线
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = wireWidth;
  ctx.shadowColor = lit ? '#b388ff' : 'transparent';
  ctx.shadowBlur = lit ? 6 : 0;

  const ex = cx + edgeDist * Math.cos(inputAngle);
  const ey = cy + edgeDist * Math.sin(inputAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // 灯泡外壳
  ctx.shadowBlur = lit ? 16 : 0;
  ctx.shadowColor = lit ? '#b388ff' : 'transparent';
  ctx.fillStyle = lit ? '#b388ff' : '#555';
  ctx.strokeStyle = lit ? '#8e5fd0' : '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, bulbRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 灯丝和灯座跟随旋转（螺口正对输入线方向）
  // 使用 ctx.rotate，与普通模式相同的绘制逻辑
  // 默认绘制方向：W底部朝下(Y+)，螺口朝下，即 angle=PI/2
  // 需要旋转 inputAngle - PI/2 使其朝向实际电线方向
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(inputAngle - Math.PI / 2);
  ctx.translate(-cx, -cy);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = lit ? '#e8d5ff' : '#666';
  ctx.lineWidth = 1.5;

  // W形灯丝（默认W底部朝Y+方向=朝下）
  const fW = bulbRadius * 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - fW, cy - bulbRadius * 0.1);
  ctx.lineTo(cx - fW / 2, cy + bulbRadius * 0.35);
  ctx.lineTo(cx, cy - bulbRadius * 0.1);
  ctx.lineTo(cx + fW / 2, cy + bulbRadius * 0.35);
  ctx.lineTo(cx + fW, cy - bulbRadius * 0.1);
  ctx.stroke();

  // 灯座条纹（在W下方Y+方向，靠近输入线）
  const baseW = bulbRadius * 0.5;
  const baseTop = cy + bulbRadius * 0.4;
  ctx.strokeStyle = lit ? '#9060d0' : '#444';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const y = baseTop + i * 3;
    ctx.beginPath();
    ctx.moveTo(cx - baseW, y);
    ctx.lineTo(cx + baseW, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHexBattery(ctx, cx, cy, r, lit, wireColor, wireWidth, rotation) {
  const batW = r * 0.525;  // 电池宽度提高50%
  const batH = r * 0.825;  // 电池高度提高50%
  const capH = r * 0.105;  // 电池正极高度提高50%
  const edgeDist = r * 0.82;

  // 获取电池的实际输出方向
  const outDir = (DIR_N + rotation) % NUM_DIRS;
  const outAngle = DIR_ANGLE[outDir];

  // 输出线
  const outColor = lit ? '#b388ff' : '#6a5a8a';
  ctx.strokeStyle = outColor;
  ctx.lineWidth = wireWidth;
  ctx.shadowColor = lit ? '#b388ff' : 'transparent';
  ctx.shadowBlur = lit ? 8 : 0;

  const ex = cx + edgeDist * Math.cos(outAngle);
  const ey = cy + edgeDist * Math.sin(outAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // 电池主体 - 以输出方向旋转
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(outAngle - 3 * Math.PI / 2); // 基础朝上(270°)，旋转到输出方向

  ctx.shadowBlur = lit ? 10 : 0;
  ctx.shadowColor = lit ? '#b388ff' : 'transparent';

  const bodyColor = lit ? '#7a6e9e' : '#5a5a6e';
  const bodyBorder = lit ? '#6352a0' : '#4a4a5e';
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = bodyBorder;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.roundRect(-batW / 2, -batH / 2 + capH, batW, batH, 3);
  ctx.fill();
  ctx.stroke();

  // 正极突起（顶部银灰色）
  const capW = batW * 0.45;
  ctx.fillStyle = lit ? '#d0d0d0' : '#999';
  ctx.strokeStyle = lit ? '#b8b8b8' : '#777';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-capW / 2, -batH / 2, capW, capH + 2, [2, 2, 0, 0]);
  ctx.fill();
  ctx.stroke();

  // 闪电符号
  const ls = r * 0.18;  // 闪电图标增大50%
  ctx.fillStyle = lit ? '#f0e6ff' : '#ccc';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(ls * 0.15, -ls);
  ctx.lineTo(-ls * 0.35, ls * 0.05);
  ctx.lineTo(ls * 0.0, ls * 0.05);
  ctx.lineTo(-ls * 0.15, ls);
  ctx.lineTo(ls * 0.35, -ls * 0.05);
  ctx.lineTo(ls * 0.0, -ls * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;
}

// ======================== 交互 ========================

function onCellClick(e) {
  if (game.paused || game.won || game.animating) return;
  const col = parseInt(e.currentTarget.dataset.col);
  const row = parseInt(e.currentTarget.dataset.row);
  rotateCell(col, row);
}

function onCellTouch(e) {
  if (game.paused || game.won || game.animating) return;
  e.preventDefault();
  const col = parseInt(e.currentTarget.dataset.col);
  const row = parseInt(e.currentTarget.dataset.row);
  rotateCell(col, row);
}

function rotateCell(col, row) {
  const cell = game.grid[row][col];
  if (!cell || cell.type === T.BATTERY || cell.type === T.FILL6) return;

  cell.rotation = (cell.rotation + 1) % NUM_DIRS;
  playSound('rotate');

  updateCircuitState();
  updateAllCells();
  updateBulbIndicator();
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
    const val = localStorage.getItem('hex_best_' + difficulty);
    return val ? parseInt(val) : null;
  } catch { return null; }
}

function setBestRecord(difficulty, seconds) {
  try {
    localStorage.setItem('hex_best_' + difficulty, seconds);
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
  const config = HEX_DIFFICULTY[difficulty];
  game.rows = config.rows;
  game.smallCols = config.smallCols;
  game.largeCols = config.largeCols;
  game.won = false;
  game.paused = false;

  document.getElementById('game-screen').style.display = 'flex';

  generateAndRender();
  updateBestDisplay();
  startTimer();
}

function generateAndRender() {
  const { rows } = game;
  const result = generateHexPuzzle(rows);
  game.grid = result.grid;
  game.solution = result.solution;
  game.tree = result.tree;
  game.batCol = result.batCol;
  game.batRow = result.batRow;
  game.solving = false;
  animatingCount = 0;
  game.animating = false;

  updateCircuitState();
  calculateHexSize();
  renderBoard();
  updateBulbIndicator();
  scheduleBeamAnimation();
}

function resetPuzzle() {
  if (game.won) return;
  playSound('click');
  game.won = false;
  game.paused = false;
  game.solving = false;
  stopBeamAnimation();
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
  stopBeamAnimation();
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

function startSolve() {
  if (game.won || game.solving) return;
  game.solving = true;
  game.paused = true;
  document.getElementById('btn-hint').style.opacity = '0.4';

  // DFS 遍历电路树，按从根（电池）开始的深度优先顺序收集需要旋转的方块
  const targets = [];
  const tree = game.tree;
  const stack = [{ col: game.batCol, row: game.batRow }];
  const visited = Array.from({ length: game.rows }, (_, r) => new Uint8Array(colsForRow(r)));
  visited[game.batRow][game.batCol] = 1;

  while (stack.length > 0) {
    const { col, row } = stack.pop();
    const cell = game.grid[row][col];
    if (cell && cell.type !== T.BATTERY && cell.type !== T.FILL6) {
      if (cell.rotation !== game.solution[row][col]) {
        targets.push({ col, row });
      }
    }
    // 按 children 顺序压栈（反序压入以保证第一个 child 先处理）
    const noff = getNeighborOffset(row);
    const children = tree[row][col].children;
    for (let i = children.length - 1; i >= 0; i--) {
      const d = children[i];
      const nc = col + noff[d][0];
      const nr = row + noff[d][1];
      if (nr >= 0 && nr < game.rows && nc >= 0 && nc < colsForRow(nr) && !visited[nr][nc]) {
        visited[nr][nc] = 1;
        stack.push({ col: nc, row: nr });
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

    const { col, row } = targets[index];
    const cell = game.grid[row][col];
    const solRot = game.solution[row][col];

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
      calculateHexSize();
      renderBoard();
    }
  }, 200);
});

document.addEventListener('dblclick', e => e.preventDefault());

// ======================== 灯泡闪烁动画（由光束到达触发） ========================

function triggerBulbFlicker(row, col) {
  const board = document.getElementById('board');
  if (!board) return;
  const divs = board.querySelectorAll('.hex-cell');
  for (const d of divs) {
    if (parseInt(d.dataset.col) === col && parseInt(d.dataset.row) === row) {
      d.classList.remove('flicker');
      void d.offsetWidth; // force reflow to restart animation
      d.classList.add('flicker');
      setTimeout(() => d.classList.remove('flicker'), 500);
      break;
    }
  }
}

// ======================== 电流光束动画 ========================

let beamTimeout = null;
let beamAnimId = null;
let beamPaths = null;

function getCellCenter(row, col) {
  const r = game.hexSize;
  const SQRT3 = Math.sqrt(3);
  const colSpacing = 3 * r;
  const rowSpacing = SQRT3 / 2 * r;
  const hexWidth = 2 * r;
  const hexHeight = SQRT3 * r;
  const offsetX = row % 2 === 0 ? colSpacing / 2 : 0;
  const cx = col * colSpacing + offsetX + hexWidth / 2;
  const cy = row * rowSpacing + hexHeight / 2;
  return { cx, cy };
}

function buildBeamPaths() {
  const { grid, rows } = game;
  // 找电池
  let batCol = -1, batRow = -1;
  for (let r = 0; r < rows; r++) {
    const rCols = colsForRow(r);
    for (let c = 0; c < rCols; c++) {
      if (grid[r][c].type === T.BATTERY) { batCol = c; batRow = r; }
    }
  }
  if (batCol < 0) return null;

  // BFS 建立电路树，记录每个节点的父节点
  const visited = Array.from({ length: rows }, (_, r) => new Uint8Array(colsForRow(r)));
  visited[batRow][batCol] = 1;
  const parentMap = {}; // "r,c" -> { pCol, pRow }
  const queue = [{ col: batCol, row: batRow }];
  const litBulbs = [];

  while (queue.length > 0) {
    const { col, row } = queue.shift();
    const cell = grid[row][col];
    if (!cell.lit) continue;
    const cellConns = getConns(cell.type, cell.rotation);
    const off = getNeighborOffset(row);

    for (const dir of cellConns) {
      const nc = col + off[dir][0];
      const nr = row + off[dir][1];
      if (nc < 0 || nr < 0 || nr >= rows || nc >= colsForRow(nr)) continue;
      if (visited[nr][nc]) continue;
      const neighbor = grid[nr][nc];
      if (!neighbor.lit) continue;
      const neighborConns = getConns(neighbor.type, neighbor.rotation);
      if (!neighborConns.has(OPPOSITE[dir])) continue;
      visited[nr][nc] = 1;
      const key = nr + ',' + nc;
      parentMap[key] = { pCol: col, pRow: row };
      if (neighbor.type === T.BULB) litBulbs.push({ col: nc, row: nr });
      queue.push({ col: nc, row: nr });
    }
  }

  if (litBulbs.length === 0) return [];

  // 随机选择部分灯泡（至少1个）
  for (let i = litBulbs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [litBulbs[i], litBulbs[j]] = [litBulbs[j], litBulbs[i]];
  }
  const keep = 1 + Math.floor(Math.random() * litBulbs.length);
  litBulbs.length = keep;

  // 从选中的灯泡回溯到电池，收集路径边
  const edges = [];
  const edgeSet = new Set();
  for (const bulb of litBulbs) {
    let curCol = bulb.col, curRow = bulb.row;
    while (true) {
      const key = curRow + ',' + curCol;
      const parent = parentMap[key];
      if (!parent) break;
      const { pCol, pRow } = parent;
      const edgeKey = pRow + ',' + pCol + '->' + curRow + ',' + curCol;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        const fromCenter = getCellCenter(pRow, pCol);
        const toCenter = getCellCenter(curRow, curCol);
        edges.push({
          fx: fromCenter.cx, fy: fromCenter.cy,
          tx: toCenter.cx, ty: toCenter.cy,
          fromCol: pCol, fromRow: pRow,
          toCol: curCol, toRow: curRow,
          level: 0,
          isBulb: false,
          bulbRow: -1, bulbCol: -1
        });
      }
      curCol = pCol;
      curRow = pRow;
    }
  }

  // 标记每个选中灯泡的终点边
  for (const bulb of litBulbs) {
    const bulbKey = bulb.row + ',' + bulb.col;
    for (const edge of edges) {
      if (edge.toRow === bulb.row && edge.toCol === bulb.col) {
        edge.isBulb = true;
        edge.bulbRow = bulb.row;
        edge.bulbCol = bulb.col;
      }
    }
  }

  // 计算层级：从电池出发沿边 BFS
  const levelMap = {};
  levelMap[batRow + ',' + batCol] = 0;
  // 邻接表: "r,c" -> [edge, ...]
  const adj = {};
  for (const edge of edges) {
    const fromKey = edge.fromRow + ',' + edge.fromCol;
    if (!adj[fromKey]) adj[fromKey] = [];
    adj[fromKey].push(edge);
  }
  const q2 = [{ col: batCol, row: batRow }];
  while (q2.length > 0) {
    const { col, row } = q2.shift();
    const curKey = row + ',' + col;
    const curLevel = levelMap[curKey];
    const outEdges = adj[curKey] || [];
    for (const edge of outEdges) {
      const tKey = edge.toRow + ',' + edge.toCol;
      if (!(tKey in levelMap)) {
        levelMap[tKey] = curLevel + 1;
        edge.level = curLevel + 1;
        q2.push({ col: edge.toCol, row: edge.toRow });
      }
    }
  }

  return edges;
}

function ensureBeamCanvas() {
  const board = document.getElementById('board');
  let canvas = document.getElementById('beam-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'beam-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    board.appendChild(canvas);
  }
  const dpr = window.devicePixelRatio || 1;
  const w = parseInt(board.style.width);
  const h = parseInt(board.style.height);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  return { canvas, dpr };
}

function animateBeam() {
  const edges = buildBeamPaths();
  if (!edges || edges.length === 0) { scheduleBeamAnimation(); return; }
  const maxLevel = Math.max(...edges.map(e => e.level));
  if (maxLevel <= 0) { scheduleBeamAnimation(); return; }

  const { canvas, dpr } = ensureBeamCanvas();
  const ctx = canvas.getContext('2d');
  const totalDuration = 500;
  const perLevel = totalDuration / maxLevel;
  const startTime = performance.now();

  function frame(now) {
    if (game.paused) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      scheduleBeamAnimation();
      return;
    }
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';

    for (const edge of edges) {
      const edgeStart = (edge.level - 1) * perLevel;
      const edgeEnd = edge.level * perLevel;
      if (elapsed < edgeStart) continue;

      const progress = Math.min((elapsed - edgeStart) / perLevel, 1);
      const ex = edge.fx + (edge.tx - edge.fx) * progress;
      const ey = edge.fy + (edge.ty - edge.fy) * progress;

      // 光束线段
      ctx.strokeStyle = 'rgba(210, 170, 255, 0.55)';
      ctx.lineWidth = 4.5;
      ctx.shadowColor = '#c9a0ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(edge.fx, edge.fy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // 光束头亮点
      if (progress < 1) {
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#e8d0ff';
        ctx.fillStyle = 'rgba(240, 215, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 光束到达灯泡末端时触发闪烁
      if (edge.isBulb && progress >= 1 && !edge._flickered) {
        edge._flickered = true;
        triggerBulbFlicker(edge.bulbRow, edge.bulbCol);
      }
    }

    ctx.restore();

    if (elapsed < totalDuration + 100) {
      beamAnimId = requestAnimationFrame(frame);
    } else {
      // 淡出
      canvas.style.transition = 'opacity 0.4s';
      canvas.style.opacity = '0';
      setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.transition = 'none';
        canvas.style.opacity = '1';
        scheduleBeamAnimation();
      }, 400);
    }
  }

  beamAnimId = requestAnimationFrame(frame);
}

function scheduleBeamAnimation() {
  stopBeamAnimation();
  const delay = 3000 + Math.random() * 3000; // 3-6s
  beamTimeout = setTimeout(() => {
    if (!game.paused && game.litBulbs > 0) {
      animateBeam();
    } else {
      scheduleBeamAnimation();
    }
  }, delay);
}

function stopBeamAnimation() {
  if (beamTimeout) { clearTimeout(beamTimeout); beamTimeout = null; }
  if (beamAnimId) { cancelAnimationFrame(beamAnimId); beamAnimId = null; }
  const canvas = document.getElementById('beam-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ======================== 从 URL 参数自动开始游戏 ========================
(function autoStart() {
  const params = new URLSearchParams(location.search);
  const d = params.get('d');
  if (d && HEX_DIFFICULTY[d]) {
    startGame(d);
  }
})();
