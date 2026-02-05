# metadata 多样本分析与统一格式建议

> 基于 `metadata_json.md` 中多份真实 metadata 样本的对比，归纳差异并给出**可统一格式**的规范 schema，供生成约束或 analyze 输出、以及 Teaching Layer（buildTeachingSnapshot）消费。

---

## 一、当前差异概览

### 1.1 根结构

| 现象 | 示例 |
|------|------|
| 均有 `meta` | 所有样本都含 `meta`，内有 title、description 等 |
| 顶层兄弟键不统一 | 有的用 `sections`，有的用 `contentStructure.stages`、`contentFlow.stages`、`pageStructure.stages` |
| 学习目标命名 | `objectives` 与 `learningObjectives` 混用 |
| 技术栈命名 | `technologyStack` / `technologies` / `technicalStack` 混用 |

### 1.2 阶段/步骤（stages）的存放位置与结构

| 位置 | 出现样本 | 单条阶段结构 |
|------|----------|----------------|
| 顶层 `sections` | 高压容器、相对论、化学、空瓶换水、汉唐、口算、Lambert、超高速碰撞 | `id`(数字或字符串) + `title` + `content`/`description`/`concept`/`formula` 等 |
| `contentStructure.stages` | 指数化简、概率、几何对称、圆外切梯形、三角形中线 | `id`/`index`/`step` + `title`/`name` + `description`/`content` + 可选 `keyConcept`/`formula` |
| `contentFlow.stages` | 蘑菇 | `id`(字符串) + `title` + `content` |
| `pageStructure.stages` | 复利 | `id` + `name` + `content` + 可选 `mathFormula` |

阶段条目的**关键教学字段**在各样本中命名不一：

- 序号：`id` / `index` / `step`
- 标题：`title` / `name`
- 说明/内容：`content` / `description` / `focus`
- 关键概念：`keyConcept` / `key_concept` / `concept`

### 1.3 conceptMap 形态

| 形态 | 示例 |
|------|------|
| 数组，项为 `{concept, description}` 或 `{concept, formula, description}` | 高压容器、指数化简、汉唐、复利、超高速碰撞等 |
| 对象 `{ 概念名: "描述字符串" }` | 企鹅、化学、Lambert |
| 数组，项为字符串 | 圆外切梯形 |

### 1.4 其他常见但命名不一的字段

- 学科/主题：`subject` / `topic` / `subtopic` / `category` / `learningCategory`
- 难度/受众：`difficulty` / `targetAudience` / `educationalLevel` / `gradeLevel` / `learningLevel`
- 总阶段数：`totalStages`（在 contentStructure 内）或从 stages 长度推断

---

## 二、统一格式是否可行

**结论：可行。** 各样本在「主题、语言、分步结构、关键概念、学习目标」上语义一致，只是**键名与嵌套位置**不同。只要约定一份**规范 schema**，并约定「生成时输出规范」或「analyze 时输出规范」，即可在平台侧稳定解析出 stages、keyConcept 等，供 Teaching Layer 使用。

两种落地方式（与 RUNTIME_TEACHING_LAYER 一致）：

1. **生成时**：在内容生成 Prompt 中要求 AI 输出的 metadata 符合**规范 schema**（见下），写入 content 或 full_html 解析结果。
2. **analyze 时**：AI Guide 分析 HTML 时，输出**规范 schema** 的 metadata_realtime，不依赖生成阶段是否已按规范写。

---

## 三、统一格式后会不会丢失关键信息？

若**只**采用最小规范（仅 topic、language、stages 的 index/title/description/key_concept、learning_objectives、signals），以下对「AI 老师」很有用的信息会**缺失**，从而削弱引导质量：

| 可能丢失的内容 | 对 AI 老师的作用 | 样本中的典型形态 |
|----------------|------------------|------------------|
| **每步公式 (formula)** | 当前步骤屏幕上的公式是什么，便于说「看这个公式」「这里的 γ 是…」 | sections[].formula、contentStructure.stages[].formula / result |
| **每步教学类型 (pedagogy)** | 知道是 Quiz/实验/讲解，才能决定是否给答案、用提问还是解释 | sections[].pedagogy、stages[].type（如 Quiz/Interaktion） |
| **完整 conceptMap** | 学生问「环向应力是什么」时能引用概念说明与公式 | conceptMap 数组或对象（多概念 + formula + description） |
| **交互方式摘要 (interactions)** | 能说「试着拖动滑块」「点一下阀门图标」而不是泛泛的「试试看」 | interactions[]（action + result）或按 stage 的 interactivity |
| **当前步可见元素 (visuals)** | 能说「图上的光钟」「数轴上的红点」 | visualElements、sections[].visuals |
| **状态变量含义 (pageStateSchema)** | 理解「当前步」「速度」等对应界面上的什么 | pageStateSchema（变量名 + 简短说明） |

**结论**：统一格式**不应只做最小集**，否则会丢关键信息、影响 AI 老师效果。建议采用**「核心必填 + 推荐扩展」**：核心保证所有内容都能解析；扩展在有时尽量保留，避免丢失上述信息。

---

## 四、推荐规范 Schema（Canonical Metadata）

以下 schema 分为**核心（必填/建议）**与**扩展（可选，供 AI 老师更好发挥）**：满足 TeachingSnapshot、Realtime 对 topic、language、stages、keyConcept 的依赖，同时**在有能力时保留公式、pedagogy、conceptMap、interactions 等**，避免关键信息丢失。

### 4.1 根结构约定

- 规范输出**根对象**即规范 metadata（可同时作为 `metadata_json` 或 `metadata_realtime` 的 payload）。
- 若现有存储是「meta + 其他兄弟键」，可在写入前或读取后**合并/映射成**该根结构；扩展字段能从原样本映射的尽量保留。

### 4.2 核心 Schema（必填 + 建议）

```json
{
  "topic": "string, 一句话主题",
  "language": "string, 如 zh-CN | en-US | de-DE",
  "stages": [
    {
      "index": "number",
      "title": "string",
      "description": "string, 可选，步骤简短说明",
      "key_concept": "string, 可选，本步关键概念或公式要点"
    }
  ],
  "learning_objectives": ["string"],
  "signals": {
    "stall_threshold_sec": "number, 可选",
    "critical_steps": ["number"]
  }
}
```

- **必填**：`topic`、`language`、`stages`（每项至少 `index`、`title`）。
- **建议**：`stages[].description`、`stages[].key_concept`、`learning_objectives`，以便 AI 老师有基本上下文。

### 4.3 扩展 Schema（可选，避免关键信息丢失）

在核心之上，**建议在生成或 analyze 时尽量一并产出**以下字段（有则填，无则省略），供 Realtime / buildTeachingSnapshot 使用，从而更好发挥 AI 老师作用：

```json
{
  "stages": [
    {
      "index": 0,
      "title": "...",
      "description": "...",
      "key_concept": "...",
      "formula": "string, 可选，本步主要公式（LaTeX 或纯文本）",
      "pedagogy": "string, 可选，如：背景引入 | 交互式实验 | Quiz | 案例分析 | 总结",
      "interactivity_hint": "string, 可选，如：拖动滑块调节气体量；点击 SVG 查看阀门"
    }
  ],
  "concept_map": [
    { "concept": "string", "formula": "string, 可选", "description": "string" }
  ],
  "interactions_summary": [
    { "action": "string", "result": "string" }
  ],
  "visual_hints": "string 或 array, 可选，当前页主要视觉元素简述（如：数轴、光钟、Canvas 粒子）"
}
```

- **stages[].formula**：本步出现的核心公式，便于 AI 老师指着公式讲。
- **stages[].pedagogy**：本步是「Quiz/实验/讲解」等，便于决定是否给答案、用提问还是解释。
- **stages[].interactivity_hint**：本步学生能做什么操作，便于说「试着拖动滑块」「点一下下一步」。
- **concept_map**：全课概念列表（概念名 + 可选 formula + description），学生追问概念时可引用。
- **interactions_summary**：全课主要交互（动作 + 结果），便于给可操作提示。
- **visual_hints**：当前页主要视觉元素，便于说「图上的光钟」「数轴」等。

以上扩展**不要求所有内容都填满**：能映射就保留，不能则省略；平台消费时**优先用扩展字段**，缺失时回退到核心字段，这样既统一格式又尽量不丢关键信息。

### 3.3 字段与现有样本的对应关系

| 规范字段 | 可从现有样本中取值的来源 |
|----------|---------------------------|
| `topic` | meta.title / meta.topic / meta.subtopic 拼接或择一 |
| `language` | meta.language（多数已有） |
| `stages` | 从 `sections` 或 `contentStructure.stages` 或 `contentFlow.stages` 或 `pageStructure.stages` 映射（见下） |
| `stages[].index` | 条目的 id（数字）或 index 或 step，若为字符串则用数组下标 |
| `stages[].title` | 条目的 title 或 name |
| `stages[].description` | 条目的 content 或 description 或 focus |
| `stages[].key_concept` | 条目的 keyConcept / key_concept / concept，或从 conceptMap 按步关联 |
| `learning_objectives` | objectives 或 learningObjectives（数组） |
| `signals` | 有则从 meta 或顶层取，无则省略或默认 |

---

## 四、从现有样本到规范格式的映射规则

以下映射可在**后端或 analyze 结果处理**中统一做一次，使 buildTeachingSnapshot 只读规范结构。

1. **确定 stages 来源**  
   按优先级取第一个存在的：`payload.sections` → `payload.contentStructure?.stages` → `payload.contentFlow?.stages` → `payload.pageStructure?.stages`。

2. **单条 stage 映射**  
   - `index` := 条目的 `index` ?? `step` ?? 数字型 `id` ?? 数组下标。  
   - `title` := 条目的 `title` ?? `name`。  
   - `description` := 条目的 `content` ?? `description` ?? `focus`。  
   - `key_concept` := 条目的 `keyConcept` ?? `key_concept` ?? `concept`（或从 conceptMap 按标题/序号关联）。

3. **topic**  
   := `meta.title` ?? `meta.topic` ?? `meta.subtopic` ?? 拼接若干。

4. **language**  
   := `meta.language` ?? `"zh-CN"`。

5. **learning_objectives**  
   := `payload.learningObjectives` ?? `payload.objectives` ?? `[]`。

6. **signals**  
   若样本中有 stall_threshold、critical_steps 等则映射，否则不设或默认。

---

## 五、混合输出结构：固定格式 + 不限格式

为兼顾「平台可解析」与「AI 老师信息丰富」，metadata 输出采用**混合结构**：一部分按**固定 schema**（canonical），另一部分为**不限格式**的页面特定信息（extras）。

### 5.1 根结构

```json
{
  "canonical": {
    "topic": "string",
    "language": "string",
    "stages": [...],
    "learning_objectives": [...],
    "signals": {...},
    "concept_map": [...],
    "interactions_summary": [...]
  },
  "extras": {
    "任意键名": "任意结构，由 AI 根据页面内容自由输出"
  }
}
```

- **canonical**：必须符合第四节规范 schema（核心必填 + 能填则填的扩展）。平台与 Teaching Layer 只消费此部分，保证 stages、keyConcept 等 deterministic。
- **extras**：不限格式。AI 可根据页面自由输出 `visualElements`、`pageStateSchema`、`gameMechanics`、`knowledgeBase`、`chemicalEquations` 等页面特有结构。AI 老师可将 extras 一并传入 system prompt，获取更丰富上下文。

### 5.2 extras 的典型内容（示例，非穷举）

| 典型键名 | 说明 |
|----------|------|
| `visualElements` | 视觉组件描述（Canvas、SVG、图表等） |
| `pageStateSchema` | 状态变量含义（currentStage、velocity 等） |
| `gameMechanics` | 游戏规则、计分、时间限制等 |
| `knowledgeBase` | 如 lookAlikes（蘑菇对比）、lookAlikes 等知识库 |
| `chemicalEquations` | 化学方程式数组 |
| `mathematicalRules` | 数学法则列表 |
| `logicSchema` | 逻辑/状态变量结构 |
| `problemStatement` | 题目条件与目标 |
| 其他 | 任何对理解页面有价值的结构 |

### 5.3 消费策略

- **buildTeachingSnapshot / Realtime**：只读取 `canonical`，若根对象无 `canonical` 则回退到「规范化函数」映射（第四节映射规则），从根对象生成 canonical。
- **AI Guide system prompt**：传入 `{ canonical, extras }` 或合并后的完整对象，让 AI 老师同时利用固定结构与页面特有信息。

### 5.4 向后兼容

- 已存储的 `metadata_json` 可能是旧格式（无 canonical/extras 包裹）。解析时：若存在 `canonical` 则直接用；否则将根对象视为「原始多样本格式」，经规范化函数产出 canonical，并将根对象中未被映射的字段视为 extras。

---

## 六、建议落地方式

1. **在生成 Prompt 中约定**：要求 AI 在输出 metadata 时**直接按规范 schema** 输出（至少包含 topic、language、stages 及每步 index、title，建议含 description、key_concept、learning_objectives）。新内容可选采用混合结构（canonical + extras）。
2. **在 analyze 中约定**：AI Guide 分析 HTML（`aiGuideService.getOrGenerateMetadata`）的返回结果**必须**包含 `canonical` 部分（固定 schema），`extras` 部分由 AI 根据页面自由发挥。参见 [6.1 Analyze Prompt 输出约定](#61-analyze-prompt-输出约定)。
3. **平台消费**：buildTeachingSnapshot、Realtime instructions 只读 `canonical`；若拿到的是「原始」多样本格式，先经一层**规范化函数**（应用第四节映射规则）生成 canonical 再使用。

### 6.1 Analyze Prompt 输出约定

用于 `aiGuideService.js` 中 `METADATA_PROMPT` 的 OUTPUT FORMAT 补充：

- 输出**必须**包含 `canonical` 对象，结构符合第四节规范 schema。
- 输出**应**包含 `extras` 对象，用于存放无法纳入 canonical 的页面特有信息（visualElements、pageStateSchema、gameMechanics 等）。
- 若根对象只有扁平结构（无 canonical/extras 包裹），平台侧先经规范化函数映射，再按需构建 canonical；analyze 输出建议直接采用混合结构，便于消费。

按此方式，**可以**在保持现有多样本兼容的前提下，通过「固定 canonical + 自由 extras」实现统一格式，并得到确定的 stages、keyConcept 等信息，同时不丢失页面特有的 rich 信息。

---

## 七、迁移脚本（历史 metadata_json 规范化）

### 7.1 分析现有结构

运行分析脚本，了解当前所有 `metadata_json` 的根键、stages 来源、字段命名等：

```bash
cd edu && node backend/scripts/analyze-metadata-json.js [--output=backend/scripts/metadata-analysis-report.json]
```

### 7.2 迁移为 canonical + extras

迁移脚本将每条 `metadata_json` 改写为 `{ canonical, extras }` 格式：

```bash
cd edu && node backend/scripts/migrate-metadata-to-canonical.js [--dry-run] [--limit=N] [--offset=N]
```

- `--dry-run`：只打印将要迁移的记录，不写库
- `--limit=N`：最多处理 N 条
- `--offset=N`：跳过前 N 条

规范化逻辑见 `backend/src/utils/metadataNormalizer.js`，映射规则与第四节一致。已为 canonical 格式的记录会做轻量校验并保留原有 extras。
