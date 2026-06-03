# Piano Studio — 架构说明

## 仓库定位

**Piano** 是一个新建仓库，从空白开始实现 **钢琴工作室（Piano Studio）** P0。

| 维度 | 说明 |
|------|------|
| 实现主体 | **本仓库** — 所有 P0 代码在此编写与验收 |
| 规格权威 | `PIANO-STUDIO-P0.md`（本仓库 `docs/`） |
| 外部宿主 | [Card-World](https://github.com/jk9988610/Card-World) — P0 完成后以 iframe 嵌入，**非当前开发环境** |
| Legacy 步进/鼓 | 存在于 Card-World 的 HarmonyForge；**本仓库不包含、不引用、不初始化** |

## 当前状态 vs 目标

```
现在                          P0 目标
─────────────────────────────────────────────────
docs/                         docs/
README.md                     index.html + css/ + js/
（无 src）                    samples/ + 可本地运行的钢琴工作室
```

## 模块架构

```
┌─────────────────────────────────────────────────────────┐
│  index.html — 独立 Web 应用入口                          │
├─────────────────────────────────────────────────────────┤
│  piano-studio.js        应用 bootstrap、DOM 挂载         │
│  piano-controller.js    键盘 / MIDI / transport 状态机   │
│  piano-event-store.js   session.events CRUD、校验        │
│  piano-scheduler.js     录制时钟、回放调度               │
│  piano-project-io.js    .hfproj 读写、legacy 拒绝        │
│  piano-keyboard.js      88 键 UI（21–108）               │
│  piano-engine.js        noteOn / noteOff（Web Audio）    │
└─────────────────────────────────────────────────────────┘
```

**边界规则（P0）**

- 不引入 Sequencer、Arranger、Pattern、BPM、步进格等概念或代码。
- 不依赖 Card-World 运行时；本地 `index.html` 即可完整验收 P0。
- 引擎只加载钢琴采样；不预加载鼓或其他乐器。

## 与 Card-World 的关系

```
阶段 A（现在）                    阶段 B（P0 验收后）
────────────────────────────────────────────────────────
Piano 仓库                        Card-World
  独立 index.html        →          embedded/piano-studio/
  本地静态服务验收                    musicEmbedUrl() → iframe
  meta.app = "piano-studio"          可选与宿主共享 origin
```

| 项 | 本仓库（阶段 A） | Card-World（阶段 B） |
|----|------------------|----------------------|
| 入口 | `index.html` | `embedded/.../index.html?lang=…` |
| Legacy 步进 | 不存在 | HarmonyForge 保留但不加载 |
| 参考代码 | 可读 [Card-World `piano-keyboard.js`](https://github.com/jk9988610/Card-World/blob/main/embedded/harmonyforge/js/piano-keyboard.js) 等作实现参考，**复制时注明来源** | 嵌入本仓库构建产物或子模块 |

## 数据格式

- 文件扩展名：`.hfproj`（JSON）
- 根级 `"schema": "piano-v1"` 必填
- `meta.app`：本仓库写入 `"piano-studio"`；嵌入 Card-World 时可改为 `"harmonyforge"` 以保持宿主一致
- 含 `patterns` / `trackLayout` 且无 `piano-v1` → **拒绝加载**（提示：「这是节奏编曲工程，请新建钢琴会话。」）

完整字段见 [PIANO-STUDIO-P0.md](./PIANO-STUDIO-P0.md) §4。

## 技术选型（P0 暂定）

| 层 | 选择 | 备注 |
|----|------|------|
| 音频 | Tone.js + Salamander 类钢琴采样 | 与 Card-World INS-008 方案对齐，便于日后合并 |
| MIDI | Web MIDI API | 不可用时仅鼠标/触摸 |
| 构建 | 无 bundler（P0） | 原生 ES module 或 `<script>` 顺序加载；后续可加 Vite |
| 部署 | GitHub Pages 或静态托管 | 独立站点；与 Card-World Pages 分离 |

## 版本

| 项 | 值 |
|----|-----|
| 会话 `formatVersion` | `1`（见 P0 规格） |
| 本仓库 App 版本 | 从 **`0.1.0`** 起（`VERSION` 文件，待建） |
| Card-World 切割版本 | **`0.14.0`**（嵌入阶段再对齐，非当前任务） |

## 权威规格

产品决策、UI 线框、验收清单：**[PIANO-STUDIO-P0.md](./PIANO-STUDIO-P0.md)**。
