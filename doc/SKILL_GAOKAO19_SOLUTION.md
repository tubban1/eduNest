# Skill: 新高考第19题解题（Gaokao-19 Solution）

本 skill 用于**所有** gaokao-19 题目（如 `conic-1-line-family-envelope.html` 等）的解题页生成，保证结构、交互与检查流程一致。

---

## 1. 代码框架与 RenderEngine

- **输出类型**：与「交互式」一致，使用 Vue 3 + stages 骨架（`INTERACTIVE_CODE_FRAMEWORK`），只填充占位符，不添加 `MutationObserver`、`renderMathInElement(document.body)`、`MathRenderManager` 或 `mount('body')`。
- **RenderEngine**：生成完成后由 RenderEngine 按 **content_type = `interactive`** 做后置检查（math、runtime、eslint、library）。使用 `output_type: gaokao19_solution` 时，后端会在返回的 JSON 中把 `content_type` 写成 `interactive`，因此无需在生成前特殊考虑，代码完成后统一检查即可。

---

## 2. 解题结构（Tab / stages）

用 **Tab（即 stages）** 区分以下部分，顺序固定：

| 顺序 | Tab 名称 | 内容要求 |
|------|-----------|----------|
| 1 | **启发引导** | 解析题目、提炼线索；用图像/动画辅助理解；整理涉及的知识点、本题考点/易错点/难点；最后给出拿分策略。 |
| 2…N | **第(1)问 / 第(2)问 / …** | 按步骤详细解答，每个小问一个单独 Tab；如需图像、图表、动画，均在对应 Tab 内实现。 |
| 最后 | **总结与验证** | 总结解题思路；可含拔高与拓展；可调参数验证结果（如可交互验证）。 |

- stages 数量由题目小问数量决定（1–5+ 均可），结构可含 title、content、公式等。
- 切换 stage 时必须触发：  
  `window.eduNestRuntime?.dispatchLearningEvent('stage_change', { stageIndex: currentStageIndex.value + 1, totalStages: stages.value.length });`

---

## 3. 题目还原与页面要求

- **完整复原题目**：将题目原文（含 LaTeX）完整放在第一个或单独题目区域，与解题 Tab 区分开。
- **Meta**：必须添加 `<meta name="description" content="...">` 和 `<meta name="keywords" content="...">`，内容为**教育/知识点向**，**不要**出现技术描述（如 vue、katex、tailwind 等）。

---

## 4. 引用库与 fallback

- **首选**：从 `supported-libraries.json` 中选用库的 CDN URL（如 jsdelivr）。
- **Fallback**：生成后由后端 `replaceLibrariesInHtml` 自动为 script 添加 OSS fallback；若在提示词中需要显式写出，格式如下（以 Vue 为例）：

```html
<script src="https://cdn.jsdelivr.net/npm/vue@3.5.20/dist/vue.global.prod.js" onerror="this.onerror=null; this.src='https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib/vue.global.prod.js'"></script>
<script>(function(){var g="Vue";var u="https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib/vue.global.prod.js";var t=setTimeout(function(){if(typeof window[g]==="undefined"){var s=document.createElement("script");s.src=u;(document.currentScript&&document.currentScript.parentNode||document.head).appendChild(s);}},5000);})();</script>
```

- 其他库（KaTeX、GSAP、D3 等）按需从 `supported-libraries.json` 取 CDN，fallback 对应 `libraries_cn.json` 中的地址；后端会自动补全 onerror 与超时注入。

---

## 5. 适用题目列表（示例）

- `trigonometry-1-t-function.html` … 三角函数新定义
- `conic-1-line-family-envelope.html` … 直线族与包络
- 其他 `gaokao-19/output/*.html` 题干页

生成时以「题目 HTML 路径或题干全文」作为输入，输出为一份完整的解题页 HTML（Vue 3 + stages，符合上述结构与事件要求）。

---

## 6. 小结

| 项目 | 要求 |
|------|------|
| 框架 | Vue 3.5.20，INTERACTIVE_CODE_FRAMEWORK 骨架，只填占位符 |
| 结构 | Tab：启发引导 → 每问一 Tab → 总结与验证 |
| 事件 | nextStage 时调用 `window.eduNestRuntime?.dispatchLearningEvent('stage_change', …)` |
| Meta | description + keywords，无技术词 |
| 库 | 首选 supported-libraries.json，fallback 由 replaceLibrariesInHtml 或上述格式处理 |
| RenderEngine | 生成后按 content_type=interactive 检查，无需生成前特殊逻辑 |

将此 skill 与 `output_type: gaokao19_solution` 的系统/用户提示词一起使用，即可对所有 gaokao-19 题目统一生成解题页。
