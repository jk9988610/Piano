# 钢琴工作室（Piano Studio）P0 权威规格

**状态**：已拍板（产品 / 架构决策记录）  
**版本**：`piano-v1`  
**日期**：2026-06-02  
**原则**：钢琴体系完全独立；P0 不使用 BPM、步进、鼓点主路径；和弦与乐谱不在 P0。

---

## 1. 决策摘要（全部锁定）

| 议题 | 决定 |
|------|------|
| 与鼓 / 步进 / 编曲 | **零耦合**；P0 UI 与数据不加载、不写入 |
| 主时钟 | **墙钟毫秒** `timeMs`，无拍号、无 BPM 字段 |
| 录制起点 | 用户按 **「录制」** 后 `timeMs=0`；此前演奏仅预览不入轨 |
| 释音 | 必须记录 **note-off**；回放以 `onMs`/`offMs` 为准 |
| 外接 MIDI | **P0 包含**（`Web MIDI API`，不可用时仅鼠标/触摸） |
| 会话条数 | **P0 仅 1 条 take**；多 take → P0.5 |
| 量化 | **P0 不做**；P1 可选按 50ms 网格吸附 |
| 旧 `.hfproj` | **拒绝加载**步进工程；提示新建钢琴会话 |
| 文件扩展名 | 仍用 **`.hfproj`**，靠根级 `schema` 区分 |
| 默认入口 | 音乐台 **一律** `mode=piano`（缺省等同 piano） |
| 采样引擎 | 仅 **INS-008** 钢琴；P0 不预加载鼓采样 |
| 和弦垫 / 乐谱 | **P2 / P3**，不进入 P0 范围 |

---

## 2. 产品定义

### 2.1 名称与心智

- 对用户：**钢琴工作室**（Piano Studio）
- 对团队：**piano-core** 体系；**legacy-rhythm**（步进/鼓/编曲）在 P0 **冻结、屏蔽**

### 2.2 P0 用户故事

1. 打开音乐入口 → 全屏 88 键，可直接弹奏。  
2. 按住键的时长与响声一致。  
3. 点「录制」→ 再弹 → 点「停止」→ 点「播放」听到与弹奏一致的时值。  
4. 保存 / 加载 `.hfproj`（钢琴会话）。  
5. 全程不见 BPM、步进格、鼓轨、Pattern、编曲段。

### 2.3 非目标（P0）

- 不与鼓对齐、不导出 MIDI 文件、无乐谱、无和弦垫、无混音台多轨、无踏板 CC（P1）。

---

## 3. 架构：双世界切割

```
┌─────────────────────────────────────────────────────────┐
│  Piano Studio (P0 主世界)                                │
│  UI → PianoController → PianoEventStore → PianoScheduler │
│                              ↓                           │
│                         InstrumentEngine (INS-008)       │
└─────────────────────────────────────────────────────────┘
          ✕ 无读写
┌─────────────────────────────────────────────────────────┐
│  Legacy Rhythm (冻结)                                    │
│  Sequencer / Arranger / Pattern / Drum samples           │
└─────────────────────────────────────────────────────────┘
```

**硬规则**

- `piano-core` 禁止 import 或调用 `Sequencer.toggleStep`、`Arranger`、步进渲染。  
- `legacy-rhythm` 在 `mode=piano` 下 **不初始化**（脚本可不加载或 `if (false)` 门闸）。  
- 共用仅限：宿主壳（Card World iframe）、日志、版本号、文件选择器。

---

## 4. 数据模型：`piano-v1`

### 4.1 根文档（`.hfproj` JSON）

```json
{
  "schema": "piano-v1",
  "formatVersion": 1,
  "meta": {
    "title": "未命名演奏",
    "createdAt": "2026-06-02T12:00:00.000Z",
    "modifiedAt": "2026-06-02T12:00:00.000Z",
    "app": "harmonyforge",
    "appVersion": "0.14.0"
  },
  "session": {
    "instrumentId": "INS-008",
    "durationMs": 0,
    "events": []
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `schema` | `"piano-v1"` | **必填**；解析器首字段校验 |
| `formatVersion` | `1` | 会话结构版本；与 app 版本解耦 |
| `session.instrumentId` | `"INS-008"` | P0 固定钢琴 |
| `session.durationMs` | number | 等于最后一条 note 的 `offMs`（或 `onMs` 若无 off） |
| `session.events` | `PianoNoteEvent[]` | 按 `onMs` 升序 |

### 4.2 `PianoNoteEvent`

```json
{
  "type": "note",
  "midi": 60,
  "onMs": 0,
  "offMs": 420,
  "velocity": 96
}
```

| 字段 | 约束 |
|------|------|
| `type` | P0 仅 `"note"` |
| `midi` | 21–108（88 键） |
| `onMs` | ≥ 0 整数毫秒 |
| `offMs` | `null`（录制中）或 `> onMs` |
| `velocity` | 1–127；默认 96 |

**录制合并规则**：同一 `midi` 在 `offMs===null` 时又来 on → 先补 `offMs=now` 再开新音。  
**回放**：在 `onMs` attack，在 `offMs` release；允许复音（同键重叠若引擎支持，否则后音抢前音——P0 采用 **后音抢前音并自动补 off**）。

### 4.3 校验

- `schema !== "piano-v1"` → 拒绝加载。  
- `schema` 缺失但存在 `patterns` / `trackLayout` → 视为 **legacy**，拒绝并提示。  
- 单文件 events 上限 P0：**10_000** 条（防卡死）。

---

## 5. 与旧 `.hfproj` 的关系

| 情况 | 行为 |
|------|------|
| `schema: piano-v1` | 正常加载 |
| 含 `patterns` 或 `trackLayout` 且无 `piano-v1` | **拒绝**；对话框：「这是节奏编曲工程。请新建钢琴会话。」 |
| 损坏 JSON | 标准错误提示 |

**不做** P0 自动迁移。迁移工具列 P1+ backlog。

---

## 6. 入口与路由（拍板）

### 6.1 URL / 启动参数

```
embedded/harmonyforge/index.html?mode=piano&lang=zh-Hans&v=…
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `mode` | `piano` | 仅实现 `piano`；其他值回退 `piano` |
| `lang` | 宿主传入 | 不变 |

Card World `musicEmbedUrl()` **固定** 带 `mode=piano`。

### 6.2 页面壳

- **加载**：`piano-studio.css`、`piano-controller.js`、`piano-event-store.js`、`piano-scheduler.js`、`piano-keyboard.js`（88 键 UI 可复用现有实现）。  
- **不加载**（P0）：`sequencer.js`、`arranger.js`、步进相关 DOM 模块（或 HTML 中 `hidden` + 不执行 init）。

### 6.3 默认工程

首次进入内存态：

```json
{ "schema": "piano-v1", "formatVersion": 1, "meta": { "title": "新演奏" }, "session": { "instrumentId": "INS-008", "durationMs": 0, "events": [] } }
```

---

## 7. UI 线框（P0）

```
┌──────────────────────────────────────────────────────────────────┐
│ ◈ 钢琴工作室          [新建] [打开] [保存]        状态：就绪      │
├──────────────────────────────────────────────────────────────────┤
│  ● 录制   ■ 停止   ▶ 播放   ⏹ 停止播放    时长 00:00 / 00:00     │
│  （无 BPM · 无小节 · 无 Pattern）                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│              [ 可横向滚动的 88 键键盘 ]                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  提示：按住琴键发声；录制后播放将还原时值。                         │
└──────────────────────────────────────────────────────────────────┘
```

**交互**

| 控件 | 行为 |
|------|------|
| 录制 | `transport=recording`；`nowMs` 从 0 递增；键盘/MIDI 写入 events |
| 停止 | 结束录制；补全所有 `offMs=null` 为当前 `nowMs`；更新 `durationMs` |
| 播放 | 按 events 调度；播放中键盘仍可预览但不写入（除非再点录制） |
| 新建 | 确认后清空 session |
| 打开 / 保存 | `.hfproj`；`schema` 必须为 `piano-v1` |

**状态机**

```
idle → recording → idle
idle → playing → idle
```

禁止 `recording` 与 `playing` 重叠。

---

## 8. 播放与音频（拍板）

### 8.1 调度

- 使用 `AudioContext.currentTime` 作为播放时钟。  
- 回放时 `audioTime = base + (event.onMs / 1000)`。  
- **播放速率** P0 固定 1×；P1 可加 0.75× / 1.25×（缩放 `onMs/offMs`，仍不引入 BPM）。

### 8.2 引擎 API（概念）

```
pianoEngine.noteOn(midi, velocity, atAudioTime)
pianoEngine.noteOff(midi, atAudioTime)
```

禁止走 `playTrackSound(trackId, stepIndex)`。

### 8.3 资源

- 启动仅 `ensureLoaded("INS-008")`。  
- 鼓类 INS-001…006 P0 **不加载**。

### 8.4 MIDI 输入

- `navigator.requestMIDIAccess()`；`onmidimessage` → 解析 note on/off → 与 UI 键盘同一入口 `PianoController.handleNote(midi, vel, isOn)`。  
- 无 MIDI：仅 UI 键盘。

---

## 9. 模块划分（实现时目录建议）

```
embedded/harmonyforge/
  js/piano/
    piano-studio.js      # 入口：mode=piano 时 init
    piano-controller.js  # 键盘/MIDI/transport 状态机
    piano-event-store.js # events CRUD、校验、durationMs
    piano-scheduler.js   # 录制时钟、回放调度
    piano-project-io.js  # 保存/加载 .hfproj
  js/piano-keyboard.js   # 88 键 UI（可迁入 piano/）
  css/piano-studio.css
  index-piano.html       # 可选：极简 HTML，仅钢琴壳（推荐 P0 用 query 门闸亦可）
```

**legacy** 文件保留在仓库，但 `piano-studio.js` 不引用。

---

## 10. 版本与发布

| 项 | 值 |
|----|-----|
| 首个钢琴主导 App 版本 | **0.14.0**（与 0.13.x 步进线切割） |
| `formatVersion` | `1` |
| SW / 缓存 | bump；`mode=piano` 资源集独立 precache 列表（后续实现） |

---

## 11. 验收清单（P0 Done）

- [ ] 默认入口仅见钢琴工作室 UI  
- [ ] 88 键：按下发声、松开止音，时长正确  
- [ ] 录制 → 播放：时值一致（误差 < 30ms）  
- [ ] 保存再打开：events 完整  
- [ ] 加载旧步进 `.hfproj`：明确拒绝  
- [ ] 无 BPM/步进/鼓 UI；无对 `Sequencer` 的 init  
- [ ] 仅 INS-008 采样加载  

---

## 12. 后续路线图（已排序，非 P0）

| 版本 | 内容 |
|------|------|
| P0.5 | 多 take 列表；会话内切换 / 删除 take |
| P1 | 钢琴卷帘编辑；撤销重做；50ms 量化；踏板 CC |
| P2 | 和弦垫 → 写入 events |
| P3 | 乐谱 JSON / MusicXML → events |
| P4 | 节奏点缀层（独立模块，默认关） |
| P5 | 可选 BPM **仅作显示网格**，非主时钟 |

---

## 13. 团队执行顺序（建议 Sprint）

1. **门闸**：`mode=piano` + 隐藏 legacy DOM + 不 init Sequencer/Arranger  
2. **数据**：`piano-event-store` + `piano-project-io` + 拒绝 legacy 工程  
3. **演奏**：`piano-controller` + INS-008 noteOn/off  
4. **录制回放**：`piano-scheduler` + transport 状态机  
5. **UI**：`piano-studio` 壳 + 复用 88 键  
6. **宿主**：Card World `musicEmbedUrl` 固定 `mode=piano`；版本 0.14.0  

---

## 14. 一句话

**P0 = 只有钢琴工作室：`piano-v1` 毫秒事件会话，与步进/鼓/ BPM 完全切割；用户能弹、能录、能存，其余能力一律不做。**
