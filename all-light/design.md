# 点亮灯泡（All Light）- 设计文档

## 1. 技术架构

```
all-light/
├── index.html              # 统一入口：难度选择 + iframe 加载游戏 + BGM 管理
├── src/
│   ├── common/
│   │   └── bgm.js          # 公共背景音乐模块
│   ├── square/
│   │   ├── index.html      # 正方形游戏页面
│   │   ├── game.js         # 正方形游戏逻辑
│   │   └── styles.css      # 正方形模式样式（也用于根页面）
│   └── hex/
│       ├── index.html      # 六边形游戏页面
│       ├── game.js         # 六边形游戏逻辑
│       └── styles.css      # 六边形模式样式
├── build/
│   └── index.html          # 构建版本（单文件）
├── assets/
│   └── hex-grid.png        # 六边形网格示例图
├── requirements.md         # 需求文档
└── design.md               # 设计文档
```

- **无构建工具**：直接打开 index.html 即可运行
- **无外部依赖**：纯原生 Web API（Canvas、Web Audio、CSS Grid、LocalStorage）
- **iframe 架构**：根页面为持久存在的外壳，游戏页面通过 iframe 加载，避免页面跳转破坏 BGM 状态

## 2. 核心模块设计

### 2.1 方向系统

```
常量定义：
  DIR_UP=0, DIR_RIGHT=1, DIR_DOWN=2, DIR_LEFT=3
  DX=[0,1,0,-1], DY=[-1,0,1,0]
  OPPOSITE=[2,3,0,1]
```

### 2.2 方块类型与基础开口

每种方块在 rotation=0 时有固定的开口方向：

| 类型 | 基础开口 |
|------|----------|
| STRAIGHT | [UP, DOWN] |
| CURVE | [UP, RIGHT] |
| TEE | [UP, RIGHT, DOWN] |
| CROSS | [UP, RIGHT, DOWN, LEFT] |
| BULB | [DOWN] |
| BATTERY | [UP] |

实际开口 = `(baseDir + rotation) % 4`

### 2.3 关卡生成算法

**流程：**

```
1. 放置电池于底部中间 (batX=cols/2, batY=rows-1)
2. DFS 生成覆盖所有格子的生成树
   - 从电池出发，随机优先方向深入
   - 每个格子记录 parentDir 和 children 列表
3. 根据树结构确定每个格子类型
   - 叶子节点（无children）→ BULB
   - 内部节点 → 根据连接数确定 STRAIGHT/CURVE/TEE/CROSS
4. 计算每个方块在全连通状态下的正确旋转（存入 solution）
5. 随机打乱所有非电池、非十字方块的旋转
6. 确保初始状态不是已解状态
```

**关键保证：**
- 每个格子都在生成树中 → 100% 可解
- solution 保存正确旋转 → 支持提示/自动还原功能

### 2.4 电线类型判定

```
wireTypeForDirs(dirs):
  4个方向 → CROSS
  3个方向 → TEE
  2个对向方向 → STRAIGHT
  2个相邻方向 → CURVE
  1个方向 → STRAIGHT（单连接退化情况）
```

### 2.5 电路连通性检测

使用 BFS 从电池出发：

```
1. 找到电池位置
2. 电池标记为 lit，入队
3. 队头出队，检查其所有开口方向
4. 若相邻格子有对应的反向开口，则标记为 lit 并入队
5. 重复直到队列为空
6. 统计点亮灯泡数，全部点亮 → 通关
```

## 3. 渲染系统

### 3.1 布局结构

```
根页面 index.html
├── #difficulty-screen (难度选择界面)
│   ├── 难度按钮组 → loadGame() 加载对应游戏页面
│   └── #btn-music-global (音乐开关)
├── <iframe id="game-frame"> (游戏加载容器)
├── #btn-music-float (游戏中悬浮音乐按钮, z-index 9999)
└── <script src="src/common/bgm.js"> (BGM 模块)

游戏页面 (iframe 内)
#game-screen (flex column)
├── #top-bar
│   ├── .top-left (本局用时 + 最佳纪录)
│   ├── .bulb-indicator (灯泡指示器，居中)
│   └── .top-right (占位，保持灯泡居中)
├── #win-bar (通关横幅，默认隐藏)
├── #board-container (flex 居中)
│   └── #board (CSS Grid)
│       └── .cell × (cols × rows)
│           └── <canvas>
├── #control-bar (控制按钮)
└── #win-return-bar (通关返回按钮，默认隐藏)
```

### 3.2 页面通信

```
游戏页面返回菜单：
  window.parent.postMessage({ type: 'backToMenu' }, '*')

根页面监听：
  window.addEventListener('message', (e) => {
    if (e.data.type === 'backToMenu') backToMenu();
  })
```

注：使用 postMessage 而非直接调用 window.parent.backToMenu()，
因为 file:// 协议下 iframe 子页面与父页面属于不同源。

### 3.2 单元格尺寸计算

```
cellSize = max(28, min(availW/cols, availH/rows, 72))
```

### 3.3 Canvas 渲染

- 使用 `devicePixelRatio` 缩放保证高清屏清晰度
- `ctx.scale(dpr, dpr)` 后按逻辑像素绘制

### 3.4 旋转动画

```
更新流程：
1. 检测到 prevRot ≠ newRot
2. 设置 canvas.style.transform = rotate(angleDelta)
3. CSS transition 80ms ease-out 播放动画（普通模式与地狱模式一致）
4. 90ms 后关闭 transition，重绘 canvas 到目标旋转
5. 清除 transform，恢复 transition
6. 动画期间 game.animating = true，阻止新的点击
```

**并发控制：**
- `animatingCount` 计数器跟踪同时动画的方块数
- 当所有动画完成（count=0）时，`game.animating = false`

## 4. 绘制细节

### 4.1 电线 (drawWire)

- 线条颜色：点亮=#f5c542，未点亮=#5a6a7a
- 线宽：`max(3, size * 0.12)`
- 点亮时添加 `shadowBlur=10` 发光效果

### 4.2 灯泡 (drawBulb)

- 输入线：从中心指向连接方向
- 灯泡外壳：圆形 `r=size*0.22`（地狱模式 `r=size*0.42`，增大50%）
- W型灯丝：W底部朝向电线方向
- 灯座条纹：2条平行线，位于W下方靠近电线侧
- 灯丝和灯座随 `cell.rotation` 旋转（普通模式用 ctx.rotate(rotation*π/2)，地狱模式用 ctx.rotate(inputAngle-π/2)）

### 4.3 电池 (drawBattery)

- 输出线：向上，点亮时使用金色 `#f5c542`
- 身体：灰绿色 `#7a9e6e`（点亮）/ `#6a7e6a`（未点亮）
- 普通模式：宽度 `size*0.38`，高度 `size*0.6`
- 地狱模式：宽度 `r*0.525`，高度 `r*0.825`，正极高度 `r*0.105`（均增大50%）
- 正极（顶部）：银灰色圆角矩形
- 闪电符号：手绘路径，地狱模式增大50%（`ls=r*0.18`）
- 整体图案随 `cell.rotation` 旋转

## 5. 交互设计

### 5.1 点击/触摸

- 点击非电池、非十字的方块 → 顺时针旋转 90°
- 同时支持 `click` 和 `touchstart` 事件
- 动画进行中、暂停状态、已通关状态下不响应

### 5.2 暂停

- 暂停遮罩覆盖全屏（`rgba(0,0,0,0.8)`）
- 暂停时停止计时和自动还原
- 提供"继续游戏"和"返回菜单"按钮

### 5.3 自动还原（提示）

- 收集所有旋转不正确的方块
- 随机打乱顺序
- 每隔 120ms 还原一个方块
- 可随时被暂停打断

## 6. 音效系统

使用 Web Audio API `OscillatorNode` + `GainNode`：

```
rotate: sine, 600→800Hz, 100ms, gain 0.15
light:  sine, 880→1200Hz, 150ms, gain 0.10
win:    4个sine, 523/659/784/1047Hz, 各300ms, 间隔150ms
click:  square, 400Hz, 50ms, gain 0.08
```

## 7. 数据持久化

```
最佳记录:
  Key: circuit_best_{difficulty} (正方形) / hex_best_{difficulty} (六边形)
  Value: 整数（秒数）
  Storage: localStorage

BGM 偏好:
  Key: bgm_on
  Value: '1' / '0'
  Storage: localStorage
```

## 8. 响应式设计

### 8.1 桌面端

- 按钮 52×52px
- 顶部栏 56px 高
- 字体 1.05em~1.25em

### 8.2 移动端（≤480px）

- 按钮 48×48px
- 顶部栏 52px 高
- 字体略缩但仍保持可读性
- 禁用 user-scalable 和 tap highlight

## 9. 地狱模式动画系统

### 9.1 电流光束动画

- 使用单独的透明 Canvas 覆盖层绘制光束
- 每 3~6 秒随机触发一次电流动画
- 路径构建算法：
  1. 从electronBFS 遍历整棵电路树，收集所有已点亮灯泡
  2. 随机选择 1~N 个目标灯泡
  3. 从目标灯泡反向追溯到电池，收集路径边
  4. BFS 计算各边层级，按层级绘制光束动画
- 动画特效：发光拖尾（lineWidth=4.5, shadowBlur=14）+ 移动光头（半径4.5px, shadowBlur=22）

### 9.2 灯泡闪烁

- 触发时机：电流光束到达灯泡末端时自动触发
- 动画时长：0.5秒
- 视觉效果：CSS @keyframes bulbFlicker，包含 brightness 和 drop-shadow 辉光脉冲

### 9.3 背景动画

- board-container 带点阵纹理 + bgPulse 动画（8秒无限循环）
- body 带网格纹理 + 径向渐变背景

## 10. BGM 音乐系统

### 10.1 架构设计

- BGM 模块（`src/common/bgm.js`）在根页面加载，生命周期与根页面一致
- 游戏页面通过 iframe 加载，不影响根页面的 AudioContext
- BGM 在游戏切换间无缝持续播放

### 10.2 自动播放策略

```
页面加载时：
  1. 检查 localStorage('bgm_on') 偏好
  2. 注册 click/touchstart 监听器
  3. 用户首次点击时，在手势调用栈中创建 AudioContext 并启动
```

注：必须在用户手势（click/touch）的直接调用栈中创建 AudioContext，
否则浏览器安全策略会将其挂起。

### 10.3 音乐开关

- 难度选择界面：内联按钮 `#btn-music-global`
- 游戏中：悬浮按钮 `#btn-music-float`（固定右上角，z-index 9999，覆盖 iframe）
- 两个按钮状态同步：通过重写 `updateMusicBtn()` 函数实现
