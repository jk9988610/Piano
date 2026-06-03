# Piano Studio

钢琴工作室（Piano Studio）— **从零搭建** 的 Web 钢琴应用。本仓库是 **唯一实现主体**；[Card-World](https://github.com/jk9988610/Card-World) 嵌入集成为后续阶段。

## 仓库现状

| 项 | 状态 |
|----|------|
| 产品 / 架构规格 | ✅ `docs/PIANO-STUDIO-P0.md` |
| 应用代码 | ⬜ 尚未开始 |
| 依赖 / 构建 | ⬜ 尚未开始 |
| Card-World 嵌入 | ⬜ P0 完成后 |

当前可直接 `git clone` 阅读文档；尚无 `index.html` 或可运行页面。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/PIANO-STUDIO-P0.md](./docs/PIANO-STUDIO-P0.md) | P0 权威规格（`piano-v1` 数据模型、UI、验收清单） |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 本仓库目录规划、模块边界、与 Card-World 的关系 |

## 目标目录（待创建）

```
index.html              # 独立入口，浏览器直接打开或静态服务
css/piano-studio.css
js/
  piano-keyboard.js     # 88 键 UI
  piano-engine.js       # 钢琴采样 / noteOn·noteOff
  piano/
    piano-studio.js     # 应用入口
    piano-controller.js
    piano-event-store.js
    piano-scheduler.js
    piano-project-io.js
samples/                # 钢琴采样（P0 仅钢琴）
```

## 开发顺序（摘要）

1. **脚手架**：`index.html` + 静态目录 + 本地预览（`python3 -m http.server`）
2. **音频 + 键盘**：Tone.js 钢琴、`piano-keyboard.js`（按下/松开发声）
3. **数据层**：`piano-event-store` + `piano-project-io`（`piano-v1` / `.hfproj`）
4. **录制回放**：`piano-scheduler` + transport 状态机
5. **UI 壳**：工具栏（新建 / 打开 / 保存 / 录制 / 播放）
6. **嵌入**（P0 之后）：合入 Card-World `embedded/`，iframe 加载

细节见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 与 [docs/PIANO-STUDIO-P0.md](./docs/PIANO-STUDIO-P0.md) §13。

## 相关仓库

- [jk9988610/Card-World](https://github.com/jk9988610/Card-World) — 卡牌世界宿主；内含 legacy HarmonyForge（步进/鼓），**与本仓库无代码共享**，仅作日后嵌入目标与参考（如 88 键 UI、INS-008 采样方案）
