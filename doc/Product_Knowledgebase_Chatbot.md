# 产品知识库方案：经销商培训文档 → 结构化知识库

> **目标**：将《经销商产品培训文档》做成结构化知识库，服务**所有客户**。用户进入平台后可咨询**产品、价格、销售、售后、分销**等问题；除文字沟通外，**推荐合适的内容**供用户体验，帮助用户**直观认识平台价值**。

---

## 一、文档内容与分类映射

培训文档现有结构可映射为以下**咨询分类**：

| 咨询类型 | 对应文档章节 | 典型问题示例 |
|---------|--------------|--------------|
| **产品功能** | 0. 所有功能介绍、2. 学习分析体系、1. 提示词库（可选） | AI 生成怎么用？AI Guide 是什么？学习分析有哪些维度？ |
| **价格与订阅** | 0. 订阅与积分、3.1 Q4/Q5、附录 价格速查 | 月付/年付多少钱？积分怎么获取？如何升级 Pro？ |
| **销售与话术** | 4. 产品优势与销售话术、5. 演示流程与最佳实践 | 和竞品比有什么优势？如何向教师/家长演示？ |
| **售后与支持** | 3.2 技术问题、3.3 账户问题、6. 技术支持与资源 | 内容无法显示怎么办？忘记密码？如何联系客服？ |
| **分销与经销商** | 6.2 经销商支持、4.2 目标用户 | 经销商有哪些支持？销售材料、培训资源？ |
| **常见问题 FAQ** | 3. 常见用户问题（Q1–Q12） | 如何生成内容？如何分享？如何查看学习报告？ |

---

## 二、结构化方案概览

### 2.1 数据模型建议

**思路**：把 MD 解析成「条目 + 分类 + 标签」，便于检索、过滤和后续 RAG。

```
知识库条目 (kb_entry)
├── id
├── category      // 产品 | 价格 | 销售 | 售后 | 分销 | FAQ
├── subcategory   // 可选，如 FAQ-功能 / FAQ-技术 / FAQ-账户
├── title         // 如 "如何生成教学内容？"
├── content       // 正文（纯文本或轻量 Markdown）
├── content_type  // faq | feature | pricing | sales_script | support | distributor
├── tags[]        // ["AI生成","积分","教师"]
├── source        // 文档内来源，如 "3.1 功能使用问题"
├── created_at / updated_at
└── embedding  // 做向量检索
```

**FAQ 专用**：可拆成 `question` + `answer` 两个字段，便于精确匹配和展示。

### 2.2 从 MD 解析到结构化数据

**建议步骤**：

1. **按二级标题切分**  
   用 `##`、`###` 做区块划分，保留层级（如 `3.1 功能使用问题` → `3.1`、`功能使用问题`）。

2. **识别区块类型**  
   - **FAQ**：`#### ❓ **Q1: ...**` / `**A:**` 模式 → 提取为 `{ question, answer }`。  
   - **功能/价格/销售/支持**：根据所属 `##` 映射到 `category`。  
   - **表格**（如竞争对比、价格速查）：转为结构化行，每条可成独立条目或附录。

3. **提取标签**  
   - 从标题、小标题、列表项抽关键词（如「AI 生成」「积分」「教师」「经销商」）。  
   - 也可用现有关键词表做匹配，减少噪音。

4. **输出格式**  
   - **JSON**：`kb_entries.json`，每条约 200–800 字，过长可再按 `####` 拆条。  
   - 或直接 **落库**（见下）。

5. **落库**  
   - 使用 **Supabase（PostgreSQL）** 新建表 `kb_entries`（或 `kb_faq` 单独存 FAQ）。  
   - 写入时带上 `category`、`content_type`、`tags`、`source`。

**可选**：写一个 **Node 脚本**（或 Python）  
- 输入：`经销商产品培训文档.md`  
- 输出：`kb_entries.json` 或直接 INSERT 到 Supabase。  
解析规则可先用手写正则/简单解析，后续再考虑用 Markdown AST 库细化。

---

## 三、存储与检索方案

### 3.1 方案 A：结构化存储 + 关键词/分类检索（推荐先行）

**存储**：  
- Supabase 表 `kb_entries`（如上结构）。  
- 无需向量、无需 embedding。

**检索**：  
- **按分类过滤**：`category = '产品' | '价格' | ...`。  
- **关键词搜索**：`content ILIKE '%积分%'` 或 PostgreSQL `plainto_tsquery` / `to_tsvector` 全文检索。  
- **FAQ**：可对 `question` 做相似度匹配（如 `ILIKE` 或 `similarity(question, $query)`，需 `pg_trgm`）。

**优点**：实现快、不依赖 embedding、易运维。  
**适用**：先解决「可查、可筛」，再考虑语义检索。

### 3.2 方案 B：向量检索（RAG）

**存储**：  
- 同上 `kb_entries`，新增 `embedding` 列（例如 `vector(1536)`，对应 OpenAI `text-embedding-3-small`）。  
- 解析脚本中增加一步：对 `title + content`（或 `question + answer`）调用 embedding API，写入 `embedding`。

**检索**：  
- 用户输入 `query` → 对 `query` 做 embedding → 在 DB 里做 `cosine similarity` 或 `<=>`（pgvector）检索 Top-K 条。  
- 可选：同时加 `category` 过滤，做成「分类 + 语义」组合检索。

**生成**：  
- 把 Top-K 条拼成 context，调用现有 AI 服务（如 `aiService` 用的 provider）生成回复。  
- System prompt 约束：仅基于知识库回答，不臆造；无法回答时建议联系客服。

**优点**：支持自然语言问法、模糊问法。  
**成本**：需要 embedding 调用、向量存储与索引；需兼顾 token 与延迟。

### 3.3 方案 C：混合（分类 + 关键词 + 向量）

- **精确匹配**：先查 FAQ `question`、价格关键词等，命中则直接返回。  
- **语义检索**：未命中时再走向量检索 + 生成。  

适合对「价格、联系方式」等需严格一致的场景，其余用 RAG 增强。

### 3.4 方案 B 与 C 评估与选择

| 维度 | 方案 B（纯向量 RAG） | 方案 C（混合） |
|------|---------------------|----------------|
| **价格、退款、联系方式** | 易被 LLM 改写或遗漏关键数字；需严格合规时风险较高 | 精确匹配优先，直接返回原文，无篡改风险 ✓ |
| **FAQ 标准问法** | 用户问「如何退款」可能与训练语料表述不同，向量检索可能略偏 | 先对 `question` 做关键词/相似度匹配，命中则直接返 answer ✓ |
| **开放问法、模糊表述** | 语义检索能力强 ✓ | 精确未命中时同样走向量 + 生成 ✓ |
| **实施复杂度** | 较简：一条检索链路 | 略高：需维护「精确匹配规则 + 向量检索」两套逻辑 |
| **成本** | 每次 query 都走 embedding + 向量检索 | 精确命中时零 embedding 调用，节省成本 ✓ |
| **运维** | 新增条目只需补 embedding | 新增条目时：精确规则（如 FAQ question）可即时生效；若走向量，需补 embedding |

**适用场景**：
- **B**：知识库体量小、问题类型单一、无强合规要求；追求实现简单。
- **C**：知识库含**价格、退款、联系方式、FAQ** 等需**严格一致**的内容；兼顾开放问法与成本；适合本产品咨询场景。

**选择结论**：**采用方案 C（混合）**。本知识库覆盖价格、退款、售后、FAQ 等需合规、不可臆造的内容，精确匹配优先可保证回复准确；开放问法由向量 + 生成兜底，兼顾体验与成本。

---

## 四、产品集成：入口与交互

### 4.1 入口

- **Help 页（`/help`）**  
  - 现有为静态「如何使用 EduNest」等内容，可**新增一块「产品咨询」**：  
    - 分类 Tab：产品 | 价格 | 销售 | 售后 | 分销 | 常见问题。  
    - 搜索框：按关键词/全文检索。  
    - 列表：展示匹配的 FAQ 或条目，点击展开答案。

- **全局入口（可选）**  
  - 在侧边栏或 header 增加「咨询」/「产品咨询」链接，跳转到 `/help#consult` 或单独 `/consult` 页。  
  - 若做 RAG，可做成聊天式「问一句话 → 出答案」，与现有 AI Guide 区分开（AI Guide 针对学习内容，咨询针对产品/价格/销售/售后/分销）。

### 4.2 交互形态

| 阶段 | 交互 |
|------|------|
| **Phase 1** | 分类 + 搜索 + 列表展示（无聊天）；**搭配内容推荐**（见 § 九） |
| **Phase 2** | 增加「问一问」：输入问题 → 调用检索（+ 可选 RAG）→ 展示答案与引用来源；**回答后推荐相关精选内容** |
| **Phase 3** | 多轮对话、反馈（有用/无用）、简单统计（如高频问题）；**推荐可随对话/角色优化** |

### 4.3 内容推荐（帮助用户感知价值）

除文字答疑外，在咨询场景**推荐平台精选内容**（交互式课件/动画），让用户**动手体验**，更好理解「AI 生成」「AI Guide」「学习分析」等能力。推荐与咨询**同期呈现**，例如：

- 在「产品咨询」列表旁 / 回答下方增加 **「为你推荐」** 区块，展示 2–4 张内容卡片。
- 用户点击卡片进入 `/c/[short_id]`，直接体验对应交互内容。
- 推荐可随**咨询分类**、**用户角色**（教师/学生/家长/机构）、**当前问题**动态调整（见 § 九）。

---

## 五、分阶段实施建议

### Phase 1：结构化 + 可查可览 + 内容推荐（约 1–2 周）

1. **解析脚本**  
   - 读 `经销商产品培训文档.md`，输出 `kb_entries.json`（含 category、content_type、tags、source、question/answer 等）。  
2. **Supabase**  
   - 建表 `kb_entries`，写入解析结果。  
   - 可选：建 `consult_demo_mapping`（见 § 九），或先用配置/静态映射。  
3. **后端 API**  
   - `GET /api/kb/entries?category=&q=&limit=`：按分类、关键词检索，返回条目列表。  
   - `GET /api/kb/recommend?category=&role=&language_code=&limit=`：按场景返回推荐内容列表（见 § 九）。  
4. **Help 页改造**  
   - 新增「产品咨询」区块：分类 Tab + 搜索 + 列表，点击展开详情。  
   - 新增 **「为你推荐」** 区块：调用 recommend API，用 `ContentCard` 展示 2–4 个精选内容，点击跳转 `/c/[short_id]`。  

**交付**：用户可查产品/价格/销售/售后/分销/FAQ，并在同一页看到与场景匹配的**可体验内容**，快速感知平台价值。

### Phase 2：混合检索 + 一键问答 + 回答后推荐（约 2–3 周）

采用 **方案 C（混合）**，检索链路为：**精确匹配 → 未命中 → 向量检索 + LLM 生成**。

1. **Embedding 与向量**  
   - 选型：OpenAI `text-embedding-3-small`（或现有 AI 提供方的 embedding）。  
   - 为 `kb_entries` 补 `embedding` 列，建立索引（如 pgvector `ivfflat`）。  
2. **检索 API（`POST /api/kb/ask`）**  
   - **第一步**：精确匹配。对 `question` 做 `ILIKE` / `similarity`，或对价格关键词（如「月付」「$29.8」「退款」）做规则匹配；命中则直接返回原文，**不走 embedding**。  
   - **第二步**：未命中时，对 `query` 做 embedding，向量检索 Top-K，拼 context 调 LLM 生成简洁回答 + 引用。  
   - 返回中增加 `recommend`：根据 `query` / 命中条目的 `category`、`tags` 调用推荐逻辑，返回 2–4 条内容。  
3. **Help 页**  
   - 增加「问一问」输入框，调用 `/api/kb/ask`，展示回答与来源链接。  
   - 在回答下方展示 **「推荐体验」** 内容卡片。  

**交付**：价格/退款/FAQ 等精确返回；开放问法由 RAG 兜底；回答后推荐精选内容。

### Phase 3：体验增强（按需）

- 多轮对话：维护会话 context，连续追问。  
- 反馈按钮：有用/无用，便于后续优化检索或解析。  
- 简单分析：统计高频问题、零结果 query，优化知识库或提示词。  
- **推荐优化**：根据用户角色、点击/体验行为微调推荐；可选 A/B 测试不同推荐策略。

---

## 九、内容推荐：帮助用户认识平台价值

除文字类沟通外，在咨询场景**推荐合适的平台内容**（交互式课件/动画），让用户**亲自体验**，更直观地理解「AI 生成」「AI Guide」「学习分析」等能力，从而认识平台价值。

### 9.1 推荐触发场景

| 场景 | 说明 | 推荐策略 |
|------|------|----------|
| **按咨询分类** | 用户选择/命中「产品功能」「销售」等 | 产品功能 → 推荐展示 AI 生成效果的 demo（如分数、几何、单词匹配）；销售 → 推荐教师/学生/家长向演示易出效果的选题 |
| **按用户角色** | 用户身份或自选：教师 / 学生 / 家长 / 机构 | 教师 → 课件类、课堂可用；学生 → 练习、探索类；家长 → 辅导+学习报告相关 demo；机构 → 课程化、系列化内容 |
| **按当前问题** | 用户提问中含学科、学段、知识点 | 从命中 KB 条目的 `tags`、`knowledge_point` 抽词，用 `tags` 调 featured API 筛选相关内容 |
| **默认/兜底** | 未登录、无明确分类或角色 | 按 `language_code` 返回全局精选（如 `quality_score` 排序）的前几条 |

### 9.2 推荐数据来源

- **现有能力**：`GET /api/content/featured` 支持 `category`（tags）、`tags`、`language_code`、`sortBy`、`limit`。精选内容来自 admin 账号，含 `tags`、`knowledge_point` 等。
- **推荐逻辑**：  
  - **方案 A（快速落地）**：维护一份 **静态映射**（如 JSON 或 config），`咨询分类` / `用户角色` → `tags[]` 或 `category`，再调 `featured?tags=...&language_code=...&limit=4`。  
  - **方案 B（可配置）**：新建表 `consult_demo_mapping`，字段如 `kb_category`、`user_role`（可选）、`content_short_id` 或 `tags[]`、`order`。运营可配置「产品功能 + 教师」推哪几条内容。  
  - **方案 C（语义延伸）**：用户问题经 RAG 命中若干 KB 条目；从条目的 `tags` 取交集或并集，作为 `tags` 调 `featured`，实现「问什么推什么」的近似效果。

### 9.3 推荐结果展示与文案

- **位置**：产品咨询列表旁（如侧边栏）、或 FAQ/问一问 **回答下方**，固定一块 **「为你推荐」** / **「推荐体验」**。  
- **形态**：复用首页 `ContentCard`，展示 2–4 个内容，点击跳转 `/c/[short_id]`。  
- **价值文案（可选）**：在推荐区块加简短说明，强化「为什么推这些」：  
  - 产品功能：「看几个交互课件，直观感受 AI 生成效果」  
  - 教师：「选一个课堂可用的 demo，体验从生成到讲解的完整流程」  
  - 学生：「试试这些练习，配合 AI Guide 边做边问」  
  - 家长：「体验 AI 辅导 + 学习报告，了解孩子学习状态」  

### 9.4 API 设计建议

```
GET /api/kb/recommend
  ?category=产品|价格|销售|售后|分销|FAQ   # 咨询分类，可选
  &role=教师|学生|家长|机构                  # 用户角色，可选
  &tags=数学,分数,小学                      # 从问题/KB 命中得出的 tags，可选
  &language_code=zh-CN                      # 与前端一致
  &limit=4
→ 返回 { data: Content[] }，与 /api/content/featured 结构兼容，便于前端直接用 ContentCard 渲染。
```

实现可封装对 `featured` 的调用，再根据 `category`、`role`、`tags` 做映射与过滤。

### 9.5 与培训文档的对应关系

培训文档 **§5 演示流程与最佳实践** 中已按角色设计演示重点（教师→节省时间+互动、学生→学习效果+AI 辅导、家长→辅导+学习分析）。内容推荐可直接对齐这些场景：**教师**推课堂向 demo，**学生**推练习+AI Guide 友好内容，**家长**推辅导与报告相关 demo，便于用户在咨询后「按角色」快速找到可体验的内容，加速价值认知。

---

## 十、内容扩展与运维

知识库结构**支持持续新增内容**（如「如何退款」「发票申请」等），不限于培训文档初始解析结果。

### 10.1 新增条目的数据归属

| 场景 | category | content_type | source | tags 示例 |
|------|----------|--------------|--------|-----------|
| 如何退款 | 售后 | support / faq | 运营补充 | 退款、订阅、取消、Pro |
| 发票申请 | 售后 | support | 运营补充 | 发票、报销 |
| 新功能说明 | 产品 | feature | 产品更新 | 新功能名 |
| 价格调整 | 价格 | pricing | 运营补充 | 月付、年付、价格 |

- `source` 为「运营补充」「新增」「产品更新」等，便于区分与溯源。  
- 现有六类（产品、价格、销售、售后、分销、FAQ）均可承载新条目，无需改 schema。

### 10.2 管理 API（运维侧）

| 接口 | 用途 |
|------|------|
| `POST /api/kb/entries` | 新增条目，body: `{ category, title, content, content_type, tags[], source?, question?, answer? }` |
| `PUT /api/kb/entries/:id` | 更新条目 |
| `DELETE /api/kb/entries/:id` | 删除条目（软删可选） |

- 需鉴权（如 admin 或专门的知识库管理角色）。  
- 若采用 **方案 C** 且新条目需参与向量检索，新增/更新时应对 `title + content` 调用 embedding API，写入 `embedding`。  
- 精确匹配（如 FAQ `question`）新增后即可生效，无需重跑 embedding。

### 10.3 embedding 同步策略

- **精确匹配型**（FAQ question、价格关键词）：新增即生效，可不写 embedding。  
- **语义检索型**：新增/更新时同步生成 embedding；或提供「重建 embedding」任务，批量处理。  
- 建议：所有条目统一写入 embedding，便于混合检索时一致使用。

---

## 十一、多语言适配

平台支持多语言（中/英/德/法等），用户会以不同语言提问。知识库需在**内容存储、检索匹配、回复语言**三方面适配。

### 11.1 内容存储策略

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 单语主库 + 运行时翻译** | 主库仅存一种语言（如中文），命中后由 LLM 按用户语言输出 | 维护成本低 | 翻译有延迟与 token 消耗；专有术语可能不准 |
| **B. 多语并行存储** | 同一语义存多条（`question_zh`/`question_en` 或按 `language_code` 分行） | 每语种可独立打磨，精确匹配可靠 | 维护多份，更新需同步 |
| **C. 单语 + 多语 embedding** | 主库单语，对多语版本分别做 embedding | 跨语言检索，存储结构简单 | 需多语 embedding 写入 |

**建议**：先采用 **A**，主库单语（如中文）；回复阶段由 LLM 按 `language_code` 输出。检索采用**多语 embedding 模型**（见下）。若关键 FAQ、价格、联系方式对表述要求高，可对部分条目做 **B** 多语存储。

### 11.2 检索适配（精确匹配仅主语言，降低维护成本）

**设计原则**：多语精确匹配（多语关键词表、多语 FAQ question）长期维护成本高。采用**精确匹配仅主语言**策略，非主语言直接走向量检索。

| 用户语言 | 处理方式 |
|----------|----------|
| **主语言**（如 zh-CN） | 精确匹配（FAQ question、价格/退款关键词）→ 命中则直接返回；未命中 → 向量检索 |
| **非主语言**（en-US、de-DE 等） | 跳过精确匹配，**直接走向量检索** |

**原因**：多语 embedding 模型已能跨语言语义匹配（如 "refund" 与「退款」在向量空间相近），无需维护多语关键词表。非主语言用户虽无法享受「精确命中零 embedding」，但省去多语关键词/FAQ 的长期维护，整体更可接受。

**精确匹配**（仅主语言）：
- 主语言 FAQ `question`、价格/退款等关键词，按主语言配置即可。
- 规则表仅维护一份（主语言），无需 `question_i18n` 或多语映射。

**向量检索**：使用 **多语 embedding 模型**（如 text-embedding-3-small、multilingual-e5、bge-m3），用户任意语言提问均可匹配主语言内容。

**例外**：价格、退款政策等强合规内容，可视需要为**极少数条目**（如 5–10 条）手工维护多语 answer，而非建通用多语关键词表。

**分类/过滤**：咨询分类为语义概念，与语言无关，可共用。

### 11.3 回复语言

- **精确匹配**（主语言命中）：主库仅存主语言，命中后由 LLM 按 `language_code` 翻译/润色后返回；或对极少数合规条目存多语 answer 直接返回。  
- **RAG 生成**：在 system prompt 中明确「请使用用户语言回复」，并传入 `language_code`。  
- 示例：`Respond in the user's language. User locale: ${language_code}.`

### 11.4 API 与前端

- `GET /api/kb/entries`：增加 `language_code` 参数，用于过滤或选择多语字段。  
- `POST /api/kb/ask`：请求体增加 `language_code`，用于判断是否走精确匹配（仅主语言）、以及 LLM 输出语言。  
- 前端：调用 `ask` 时从 `i18n.language` 或用户偏好传入 `language_code`；咨询入口、分类 Tab 沿用现有 i18n。  
- 推荐：`recommend` 的 `language_code` 与当前界面一致，沿用 `featured` 的 `language_code` 过滤。

### 11.5 实施优先级

| 优先级 | 动作 |
|--------|------|
| **P0** | 采用多语 embedding 模型，支持任意语言提问匹配主库 |
| **P0** | `ask` 传入 `language_code`，LLM 按用户语言输出 |
| **P1** | 精确匹配规则**仅主语言**（FAQ question、价格/退款关键词），零多语维护 |
| **P2** | 强合规条目（价格、退款等）可手工维护少量多语 answer（按需） |

---

## 十二、实施规划

### 12.1 阶段与工期

| 阶段 | 工期 | 交付物 |
|------|------|--------|
| **Phase 1** | 1–2 周 | 解析脚本、`kb_entries` 表、`entries` + `recommend` API、Help 页「产品咨询」+「为你推荐」 |
| **Phase 2** | 2–3 周 | `embedding` 列、混合检索 `ask` API（方案 C）、「问一问」+ 回答后推荐 |
| **Phase 3** | 按需 | 多轮对话、反馈、统计、推荐优化 |
| **运维** | 持续 | 管理 API、内容扩展（如退款、发票）、embedding 同步 |

### 12.2 任务分解

**Phase 1**

| 任务 | 负责人建议 | 产出 |
|------|------------|------|
| 1.1 解析脚本 | 后端/脚本 | `kb_entries.json` 或直写 DB |
| 1.2 Supabase 建表 | 后端 | `kb_entries` 表结构 |
| 1.3 `GET /api/kb/entries` | 后端 | 分类 + 关键词检索 |
| 1.4 `GET /api/kb/recommend` | 后端 | 场景映射 + 调 featured；支持 `language_code`（§ 十一） |
| 1.5 Help 页改造 | 前端 | 产品咨询 Tab + 搜索 + 列表 + 为你推荐；传 `i18n.language` 至 API |

**Phase 2**

| 任务 | 负责人建议 | 产出 |
|------|------------|------|
| 2.1 pgvector + embedding 列 | 后端 | 表结构 + 初始 embedding；采用**多语 embedding 模型**（§ 十一） |
| 2.2 精确匹配规则 | 后端 | FAQ question、价格关键词、退款等；**仅主语言**，非主语言直接走向量（§ 十一） |
| 2.3 `POST /api/kb/ask`（混合链路） | 后端 | 精确优先 → 向量兜底 → LLM 生成；支持 `language_code`，LLM 按用户语言输出 |
| 2.4 Help 页「问一问」 | 前端 | 输入框 + 回答展示 + 推荐体验；传入 `language_code` |

**运维**

| 任务 | 产出 |
|------|------|
| 管理 API（增删改） | `POST/PUT/DELETE /api/kb/entries` |
| 新增条目 embedding 同步 | 写入时或批量任务 |
| 内容扩展 | 如退款、发票等条目 |

### 12.3 依赖与风险

- **依赖**：Supabase（已有）、pgvector 扩展、OpenAI 或现有 AI 提供方的 embedding API。  
- **风险**：embedding 调用有成本与延迟；精确匹配规则需随业务迭代维护。  
- **缓解**：方案 C 下精确命中不走 embedding；规则可配置化（如存表或 JSON）。

---

## 六、技术选型简表

| 项目 | 建议 |
|------|------|
| **存储** | Supabase（PostgreSQL），表 `kb_entries`；可选 `consult_demo_mapping` |
| **向量** | pgvector 扩展；embedding 采用**多语模型**（如 text-embedding-3-small、multilingual-e5） |
| **解析** | Node 脚本 + 正则 / Markdown 解析库，输出 JSON 或直写 DB |
| **检索 Phase 1** | `category` + `ILIKE` / 全文 `to_tsvector` |
| **检索 Phase 2** | **方案 C 混合**：精确匹配（FAQ/价格/退款）优先 → 未命中时 pgvector + LLM 生成 |
| **推荐** | 复用 `GET /api/content/featured`；新增 `GET /api/kb/recommend` 做场景映射与聚合 |
| **API** | 新增 `/api/kb` 路由：`entries`、`ask`、`recommend`；均支持 `language_code`（§ 十一） |
| **前端** | Help 页加「产品咨询」+ **「为你推荐」**；复用 `ContentCard`，链向 `/c/[short_id]` |

---

## 七、内容范围与边界

- **纳入**：产品功能、价格与订阅、销售话术与演示、售后与支持、分销与经销商、常见问题。  
- **排除**：提示词库（1. 各年级各科目）体量较大且偏「创作工具」而非「产品咨询」，建议**暂不**放入统一知识库；若需，可单独做成「提示词检索」小功能。  
- **合规**：回复中**不编造**价格、联系方式；无法从知识库推断时，明确引导「请联系客服 / 销售」。  
- **推荐**：仅推荐平台内**已有精选内容**（如 featured）；不引用外链或非平台资源。推荐文案需与培训文档 §5 演示场景、角色一致，避免夸大。

---

## 八、总结

1. **先结构、再检索**：把培训文档解析成带分类、标签的 `kb_entries`，落 Supabase。  
2. **检索方案**：采用 **方案 C（混合）**。Phase 1 分类 + 关键词；Phase 2 精确匹配优先（价格/退款/FAQ），未命中时向量 + LLM 兜底，兼顾合规与开放问法。  
3. **入口**：Help 页新增「产品咨询」为主入口，可选全局「咨询」链接。  
4. **范围**：覆盖产品、价格、销售、售后、分销、FAQ；提示词库可后续按需单独做。  
5. **内容扩展**：结构支持**新增条目**（如如何退款、发票申请），通过管理 API 运维；详见 § 十。  
6. **多语言**：主库单语，多语 embedding + LLM 按 `language_code` 输出；**精确匹配仅主语言**，非主语言直接走向量，降低多语关键词维护成本；详见 § 十一。  
7. **推荐与价值感知**：除文字沟通外，在咨询页/回答后**推荐合适内容**（§ 九）。按咨询分类、用户角色、当前问题推荐精选 demo，用户**边看边体验**，更快认识平台价值。

按上述 Phase 1 → 2 推进，即可把经销商培训文档转化为**对全平台用户开放的结构化产品知识库**，支持产品、价格、销售、售后、分销等咨询，并借**内容推荐**强化用户对平台价值的认知。

---

## 十三、附录：表结构、示例代码与 Prompt

### 13.1 数据库表结构（Supabase / PostgreSQL）

#### kb_entries 主表

```sql
-- 启用 pgvector 扩展（若尚未启用）
CREATE EXTENSION IF NOT EXISTS vector;

-- 咨询分类枚举
CREATE TYPE kb_category AS ENUM ('产品', '价格', '销售', '售后', '分销', 'FAQ');

-- 内容类型枚举
CREATE TYPE kb_content_type AS ENUM ('faq', 'feature', 'pricing', 'sales_script', 'support', 'distributor');

CREATE TABLE kb_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category kb_category NOT NULL,
  subcategory TEXT,                          -- 可选：如 FAQ-功能、FAQ-技术
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type kb_content_type NOT NULL,
  question TEXT,                             -- FAQ 专用：标准问题
  answer TEXT,                               -- FAQ 专用：标准答案
  tags TEXT[] DEFAULT '{}',
  source TEXT,                               -- 文档来源，如 "3.1 功能使用问题"
  language_code TEXT DEFAULT 'zh-CN',        -- 主语言，用于精确匹配
  embedding vector(1536),                    -- OpenAI text-embedding-3-small 维度
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_kb_entries_category ON kb_entries(category);
CREATE INDEX idx_kb_entries_content_type ON kb_entries(content_type);
CREATE INDEX idx_kb_entries_tags ON kb_entries USING GIN(tags);
CREATE INDEX idx_kb_entries_language ON kb_entries(language_code);

-- 全文检索（Phase 1 关键词搜索）
CREATE INDEX idx_kb_entries_content_fts ON kb_entries 
  USING GIN(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(question, '')));

-- 向量索引（Phase 2，ivfflat 适合中等规模 <100万）
CREATE INDEX idx_kb_entries_embedding ON kb_entries 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- pg_trgm 用于 similarity() 相似度匹配（精确匹配 FAQ 时可选）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_kb_entries_question_trgm ON kb_entries USING GIN(question gin_trgm_ops);  -- 需 pg_trgm 扩展
```

#### consult_demo_mapping 推荐映射表（可选）

```sql
CREATE TABLE consult_demo_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_category kb_category NOT NULL,
  user_role TEXT,                            -- 教师|学生|家长|机构，NULL 表示通用
  content_short_id TEXT NOT NULL,            -- 关联 content 表
  tags TEXT[] DEFAULT '{}',                  -- 或直接用 tags 映射，不指定具体内容
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consult_demo_mapping_category ON consult_demo_mapping(kb_category);
```

---

### 13.2 解析脚本示例（Node.js）

```javascript
// scripts/parse-kb-md.js
const fs = require('fs');
const path = require('path');

const MD_PATH = path.join(__dirname, '../经销商产品培训文档.md');
const OUTPUT_JSON = path.join(__dirname, '../kb_entries.json');

// 分类映射：根据 ## 标题映射到 category
const SECTION_TO_CATEGORY = {
  '0. 产品介绍': '产品',
  '0. 订阅与积分': '价格',
  '2. 学习分析': '产品',
  '3.1 功能使用': 'FAQ',
  '3.2 技术问题': '售后',
  '3.3 账户问题': '售后',
  '4. 产品优势': '销售',
  '5. 演示流程': '销售',
  '6. 技术支持': '售后',
  '6.2 经销商': '分销',
};

function parseMdToEntries(mdContent) {
  const entries = [];
  const sections = mdContent.split(/\n(?=## )/);
  let currentCategory = 'FAQ';

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0];
    const sectionMatch = header.match(/^## (.+)$/);
    if (sectionMatch) {
      const key = Object.keys(SECTION_TO_CATEGORY).find(k => header.includes(k));
      if (key) currentCategory = SECTION_TO_CATEGORY[key];
    }

    // FAQ 模式：#### ❓ **Q1: xxx** ... **A:** yyy
    const faqRegex = /####\s*❓\s*\*\*Q\d+:\s*(.+?)\*\*[\s\S]*?\*\*A:\*\*\s*([\s\S]+?)(?=####|$)/gi;
    let m;
    while ((m = faqRegex.exec(section)) !== null) {
      entries.push({
        category: currentCategory,
        subcategory: null,
        title: m[1].trim(),
        content: m[2].trim(),
        content_type: 'faq',
        question: m[1].trim(),
        answer: m[2].trim(),
        tags: extractTags(m[1] + ' ' + m[2]),
        source: header.replace(/^## /, ''),
        language_code: 'zh-CN',
      });
    }

    // 非 FAQ 区块：按 ### 切分
    const subsections = section.split(/\n(?=### )/).slice(1);
    for (const sub of subsections) {
      const subLines = sub.split('\n');
      const subTitle = subLines[0].replace(/^###\s*/, '');
      const subContent = subLines.slice(1).join('\n').trim();
      if (subContent.length > 50) {
        entries.push({
          category: currentCategory,
          subcategory: subTitle,
          title: subTitle,
          content: subContent,
          content_type: mapContentType(currentCategory),
          question: null,
          answer: null,
          tags: extractTags(subTitle + ' ' + subContent),
          source: header.replace(/^## /, '') + ' / ' + subTitle,
          language_code: 'zh-CN',
        });
      }
    }
  }

  return entries;
}

function extractTags(text) {
  const keywords = ['AI生成', 'AI Guide', '积分', '订阅', 'Pro', '教师', '学生', '家长', '经销商', '退款', '价格', '月付', '年付'];
  return keywords.filter(k => text.includes(k));
}

function mapContentType(cat) {
  const map = { 产品: 'feature', 价格: 'pricing', 销售: 'sales_script', 售后: 'support', 分销: 'distributor', FAQ: 'faq' };
  return map[cat] || 'faq';
}

const md = fs.readFileSync(MD_PATH, 'utf-8');
const entries = parseMdToEntries(md);
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(entries, null, 2), 'utf-8');
console.log(`Parsed ${entries.length} entries -> ${OUTPUT_JSON}`);
```

---

### 13.3 Embedding 方法

#### 选型

| 模型 | 维度 | 多语言 | 说明 |
|------|------|--------|------|
| **OpenAI text-embedding-3-small** | 1536 | ✓ | 推荐，质量好、多语支持 |
| **OpenAI text-embedding-3-large** | 3072 | ✓ | 更高精度，成本更高 |
| **multilingual-e5-large** | 1024 | ✓ | 开源，自托管 |
| **bge-m3** | 1024 | ✓ | 开源，中英效果佳 |

#### 示例代码（OpenAI text-embedding-3-small）

```javascript
// lib/kb/embedding.js
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

async function getEmbedding(text) {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // 限制长度
  });
  return res.data[0].embedding;
}

async function embedEntry(entry) {
  const textToEmbed = [entry.title, entry.content, entry.question, entry.answer]
    .filter(Boolean)
    .join('\n\n');
  return getEmbedding(textToEmbed);
}

// 批量写入 embedding 到 Supabase
async function syncEmbeddings(supabase) {
  const { data: entries } = await supabase
    .from('kb_entries')
    .select('id, title, content, question, answer')
    .is('embedding', null);

  for (const entry of entries || []) {
    const embedding = await embedEntry(entry);
    await supabase
      .from('kb_entries')
      .update({ embedding, updated_at: new Date().toISOString() })
      .eq('id', entry.id);
    await sleep(100); // 限速
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
```

#### pgvector 向量检索示例

```sql
-- 余弦相似度检索 Top 5
SELECT id, title, content, 1 - (embedding <=> $1::vector) AS similarity
FROM kb_entries
WHERE embedding IS NOT NULL
  AND language_code = 'zh-CN'
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

```javascript
// 传入 query 的 embedding
const queryEmbedding = await getEmbedding(userQuery);
const { data } = await supabase.rpc('match_kb_entries', {
  query_embedding: queryEmbedding,
  match_threshold: 0.7,
  match_count: 5,
});

// 或直接用 raw SQL
const { data } = await supabase
  .from('kb_entries')
  .select('id, title, content, question, answer')
  .not('embedding', 'is', null)
  .limit(5);
// 注意：pgvector 的 <=> 需通过 RPC 或 raw query，见 Supabase 文档
```

---

### 13.4 Prompt 示例

#### System Prompt（RAG 生成）

```
你是一个 EduNest 产品顾问，只根据以下知识库内容回答用户问题。

规则：
1. 仅使用提供的「参考内容」回答，不得编造价格、联系方式或政策。
2. 若参考内容不足以回答，请明确说「该问题暂无法从知识库回答，建议联系客服」。
3. 回复必须使用用户的语言（根据 language_code）。
4. 回复简洁清晰，必要时可分点列举。
5. 可适当引导用户「点击下方推荐内容亲自体验」。

参考内容：
---
{{CONTEXT}}
---
```

#### User Prompt 模板

```
用户问题：{{USER_QUERY}}
用户语言：{{LANGUAGE_CODE}}
请根据上述参考内容用用户语言回答。
```

#### Context 组装格式

```javascript
const context = retrievedEntries
  .map((e, i) => `[${i + 1}] 标题：${e.title}\n内容：${e.content || e.answer}`)
  .join('\n\n---\n\n');
```

---

### 13.5 精确匹配规则示例（主语言 zh-CN）

```javascript
// lib/kb/exact-match.js

// 价格/退款关键词 → 命中则直接查对应条目
const EXACT_MATCH_KEYWORDS = {
  price: ['月付', '年付', '$29.8', '$240', '多少钱', '价格', '订阅费用'],
  refund: ['退款', '退订', '取消订阅', '如何退'],
  contact: ['客服', '联系方式', '电话', '邮箱', 'support'],
};

// FAQ question 相似度匹配（需 pg_trgm）
// SQL: SELECT * FROM kb_entries 
//      WHERE content_type = 'faq' 
//        AND language_code = 'zh-CN'
//        AND similarity(question, $query) > 0.3
//      ORDER BY similarity(question, $query) DESC
//      LIMIT 1;

// 或 ILIKE 简化版
// WHERE question ILIKE '%' || $query || '%'
```

---

### 13.6 API 路由示例（Next.js）

#### GET /api/kb/entries

```javascript
// app/api/kb/entries/route.js
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');
  const lang = searchParams.get('language_code') || 'zh-CN';

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  let query = supabase
    .from('kb_entries')
    .select('id, category, title, content, content_type, question, answer, tags, source')
    .eq('language_code', lang)
    .limit(limit);

  if (category) query = query.eq('category', category);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,question.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
```

#### POST /api/kb/ask（混合检索）

```javascript
// app/api/kb/ask/route.js
export async function POST(req) {
  const { query, language_code = 'zh-CN', role } = await req.json();
  const supabase = createClient(...);

  // 1. 精确匹配（仅主语言）
  if (language_code === 'zh-CN') {
    const exact = await exactMatch(supabase, query);
    if (exact) {
      const recommend = await getRecommend(supabase, { category: exact.category, role, language_code });
      return Response.json({ answer: exact.answer || exact.content, source: exact, recommend });
    }
  }

  // 2. 向量检索 + LLM 生成
  const embedding = await getEmbedding(query);
  const { data: retrieved } = await supabase.rpc('match_kb_entries', {
    query_embedding: embedding,
    match_count: 5,
  });

  const context = retrieved?.map(e => `${e.title}\n${e.content || e.answer}`).join('\n\n') || '';
  const answer = await generateWithLLM(context, query, language_code);
  const recommend = await getRecommend(supabase, { tags: extractedTags(retrieved), role, language_code });

  return Response.json({ answer, sources: retrieved, recommend });
}
```

#### GET /api/kb/recommend

```javascript
// app/api/kb/recommend/route.js
const CATEGORY_TO_TAGS = {
  '产品': ['数学', '分数', '几何'],
  '价格': [],
  '销售': ['教师', '演示'],
  '售后': [],
  '分销': [],
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const role = searchParams.get('role');
  const tags = searchParams.get('tags')?.split(',');
  const language_code = searchParams.get('language_code') || 'zh-CN';
  const limit = parseInt(searchParams.get('limit') || '4');

  const tagsToUse = tags?.length ? tags : CATEGORY_TO_TAGS[category] || [];
  let apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/content/featured?language_code=${language_code}&limit=${limit}`;
  if (tagsToUse.length) apiUrl += `&tags=${encodeURIComponent(tagsToUse.join(','))}`;

  const res = await fetch(apiUrl);
  const json = await res.json();
  return Response.json({ data: json.data || [] });
}
```

---

### 13.7 Supabase RPC（向量匹配）

在 Supabase SQL Editor 中创建：

```sql
CREATE OR REPLACE FUNCTION match_kb_entries(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  category kb_category,
  title text,
  content text,
  question text,
  answer text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.category,
    e.title,
    e.content,
    e.question,
    e.answer,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM kb_entries e
  WHERE e.embedding IS NOT NULL
    AND (filter_category IS NULL OR e.category::text = filter_category)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

**文档版本**：v1.5  
**更新日期**：2026-01  
**v1.1**：新增 § 九 内容推荐、§4.3 推荐入口、Phase 1/2/3 推荐相关改动。  
**v1.2**：§3.4 方案 B/C 评估与选择（采用方案 C）；§ 十 内容扩展与运维；§ 十二 实施规划；Phase 2 明确混合检索链路。  
**v1.3**：§ 十一 多语言适配；实施规划与技术选型补充多语相关任务。  
**v1.4**：§ 11.2 检索适配简化为「精确匹配仅主语言」，非主语言直接走向量；移除多语关键词/FAQ 维护，降低长期运维成本。  
**v1.5**：新增 § 十三 附录：完整表结构、解析脚本、embedding 方法、Prompt 示例、API 与 RPC 示例。
**v1.1**：新增 § 九 内容推荐、§4.3 推荐入口、Phase 1/2/3 推荐相关改动。  
**v1.2**：§3.4 方案 B/C 评估与选择（采用方案 C）；§ 十 内容扩展与运维；§ 十二 实施规划；Phase 2 明确混合检索链路。  
**v1.3**：§ 十一 多语言适配；实施规划与技术选型补充多语相关任务。  
**v1.4**：§ 11.2 检索适配简化为「精确匹配仅主语言」，非主语言直接走向量；移除多语关键词/FAQ 维护，降低长期运维成本。
