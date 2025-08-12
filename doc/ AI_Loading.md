以下是你需要的用于 Cursor 平台开发的 **Loading 动画功能开发文档**，包括：

* 运行逻辑说明
* 动画状态控制机制
* 封装的 JSON 文案资源（专业词汇风格）
* UI 插入位置说明

---

## 🧩 功能模块：AI 内容生成时的 Loading 动画系统（适配 Cursor）

---

### 🧷 目标用途

在 Vue 教学交互项目生成过程中，由于 AI 接口响应时间较长（2–3 分钟），使用一个动态、渐进式动画系统模拟大型 AI 教学工程构建流程，提升用户等待期间的体验感、专业感和沉浸感。

---

## 🔁 动画运行逻辑

| 项目          | 描述                                                         |
| ----------- | ---------------------------------------------------------- |
| **阶段数量**    | 9 个主要阶段，逐步呈现，整体模拟教学项目从构思到上线                                |
| **每阶段时长**   | 默认每阶段动画运行约 10 秒                                            |
| **AI 响应监听** | 动画运行期间实时监听 API 响应。如果在某阶段收到返回内容，则立即终止动画，并进行内容渲染             |
| **循环机制**    | 若未在 9 个阶段完成前收到返回结果，则第 9 个阶段循环播放，直到接口成功返回或报错                |
| **插入位置**    | 显示在 AI 生成内容页面中，在iframe的位置，替代静态 loading indicator，始终保持可见，直至渲染完成 |

---

## 🧩 动画内容 JSON 配置（专业技术风格）

```json
{
  "stages": [
    {
      "name": "Knowledge Parsing",
      "messages": [
        "Initializing conceptual graph for {{knowledge_point}}…",
        "Extracting semantic hierarchy and latent structures…",
        "Decoding taxonomies and domain relevance vectors…"
      ]
    },
    {
      "name": "Pedagogical Modeling",
      "messages": [
        "Generating learning scaffolds and progression schema…",
        "Simulating cognitive load maps for effective sequencing…",
        "Aligning outcomes with adaptive instructional design…"
      ]
    },
    {
      "name": "Interface Schema Synthesis",
      "messages": [
        "Building interface layout trees and responsive containers…",
        "Injecting accessibility vectors and tactile UX models…",
        "Establishing visual narrative flow and structural rhythm…"
      ]
    },
    {
      "name": "Logic and Computation Layer",
      "messages": [
        "Composing reactive logic with declarative bindings…",
        "Instantiating interaction events and stateflows…",
        "Defining dynamic data graphs for UI orchestration…"
      ]
    },
    {
      "name": "Motion and Feedback Systems",
      "messages": [
        "Embedding transition curves and gesture mappings…",
        "Sequencing keyframe events for pedagogical emphasis…",
        "Constructing micro-feedback mechanisms in real-time…"
      ]
    },
    {
      "name": "Auditory Architecture",
      "messages": [
        "Mapping cognitive events to tonal feedback cues…",
        "Integrating procedural audio with concept triggers…",
        "Optimizing feedback latency with Tone.js core…"
      ]
    },
    {
      "name": "Dependency and Runtime Linking",
      "messages": [
        "Injecting runtime modules and loading external graphs…",
        "Verifying CDN resolutions and interface exposure maps…",
        "Configuring sandbox security and runtime bridges…"
      ]
    },
    {
      "name": "Systemic Testing",
      "messages": [
        "Running interaction stress tests with simulated agents…",
        "Measuring feedback loop integrity and accessibility thresholds…",
        "Analyzing logical cohesion across user paths…"
      ]
    },
    {
      "name": "Deployment Pipeline",
      "messages": [
        "Bundling resources and launching runtime sandbox…",
        "Streaming deployment payload to sandbox environment…",
        "Stabilizing environment… Preparing first render…"
      ]
    }
  ]
}
```

---

## ⚙️ 前端实现建议（Cursor 内部适配）

### ✅ 监听逻辑建议（伪代码）：

```ts
let stageIndex = 0
const INTERVAL = 10000 // 每阶段 10s
let loadingActive = true

startLoading()

const loadingInterval = setInterval(() => {
  if (apiResponseReady || apiError) {
    loadingActive = false
    stopLoadingAnimation()
    clearInterval(loadingInterval)
  } else {
    updateToNextStage() // 进入下一个阶段或循环最终阶段
  }
}, INTERVAL)
```

---

### 💡 插入位置建议

* 插入在 **AI 生成内容的表单区域下方**。
* 样式建议为：

  * **占满 form 下方区域宽度**
  * 动画状态右上角显示当前阶段名称
  * 每条 message 带打字机动画 + 渐隐效果
  * Optionally：百分比进度条、旋转光圈、拼图动画等辅助加载效果

---
