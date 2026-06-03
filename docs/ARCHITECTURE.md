# Piano Studio — 架构说明

本仓库是 **钢琴工作室（Piano Studio）** 的独立开发与规格仓库。运行时实现嵌入在 [Card-World](https://github.com/jk9988610/Card-World) 的 `embedded/harmonyforge/` 中，由 Card World 音乐台 iframe 加载。

## 权威规格

P0 全部产品 / 架构决策见 **[PIANO-STUDIO-P0.md](./PIANO-STUDIO-P0.md)**（来源：Card-World `docs/PIANO-STUDIO-P0.md`）。

## 双世界切割

| 世界 | 状态（P0） | 职责 |
|------|-----------|------|
| **piano-core** | 主世界 | 88 键 UI、毫秒事件录制/回放、`piano-v1` 会话 I/O |
| **legacy-rhythm** | 冻结 | 步进音序、编曲时间轴、鼓采样；`mode=piano` 下不初始化 |

共用层：Card World iframe 宿主、日志、版本号、文件选择器。

## 仓库分工

| 仓库 | 角色 |
|------|------|
| **Piano**（本仓库） | 规格、设计、独立原型、测试夹具；P0 实现可在此验证后合入 Card-World |
| **Card-World** | 宿主 + HarmonyForge 嵌入；`musicEmbedUrl()` 固定 `mode=piano` |
| **HarmonyForge**（Card-World 内嵌） | 音频引擎（INS-008）、`piano-keyboard.js` 等可复用模块 |

## 数据格式

- 扩展名：`.hfproj`（与 legacy 相同）
- 区分字段：根级 `"schema": "piano-v1"`
- legacy 工程（含 `patterns` / `trackLayout`）：**拒绝加载**，不做 P0 迁移

## 版本线

- Card-World / HarmonyForge **0.13.x**：步进/鼓线（legacy-rhythm）
- **0.14.0**：钢琴主导线切割起点（`formatVersion: 1`）
