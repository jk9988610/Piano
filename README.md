# Piano Studio

钢琴工作室（Piano Studio）— 独立 Web 钢琴应用：88 键演奏、毫秒级录制回放、`.hfproj` 会话保存。

**线上预览**（GitHub Pages 部署后）：https://jk9988610.github.io/Piano/

## 仓库现状

| 项 | 状态 |
|----|------|
| 产品 / 架构规格 | ✅ `docs/PIANO-STUDIO-P0.md` |
| 应用代码 | ✅ `index.html` + `js/` + `samples/` |
| GitHub Pages | ✅ `.github/workflows/deploy-pages.yml` |
| 乐谱演奏（JSON → 播放） | ✅ v0.3.0 |
| Card-World 嵌入 | ⬜ P0 完成后 |

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/
```

## 文档

| 文档 | 说明 |
|------|------|
| [docs/PIANO-STUDIO-P0.md](./docs/PIANO-STUDIO-P0.md) | P0 权威规格 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构与仓库分工 |

## 目录

```
index.html
css/piano-studio.css
js/
  tone.min.js
  piano-engine.js
  piano-keyboard.js
  piano/               # piano-core 模块
samples/INS-008/       # Salamander 钢琴采样
scores/                # 示例 JSON 乐谱（piano-score-v1）
```

## 相关仓库

- [jk9988610/Card-World](https://github.com/jk9988610/Card-World) — 日后 iframe 宿主；88 键 UI 与采样方案参考来源
