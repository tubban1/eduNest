## 统一入口：咨询 & 生成（Unified AI Entry）

### 1. 设计目标

- **单一入口**：无论是「产品咨询」（知识库问答）还是「内容生成」（写文案、改写提示词等），前端都只调一个 API。
- **自动路由**：后端根据用户 `query` 自动判断意图，路由到 `kb` 问答、通用生成或其他 handler。
- **可观察性**：统一记录意图、预处理后的 `query`、命中通路，方便埋点分析和持续优化。

---

### 2. 推荐的整体流程

原始 `query` 的处理链路：

> 原始 query →（轻度清洗）→ 意图判断 →（语义归一化）→ 检索 / 生成

- **轻度清洗（lightClean）**
  - `trim`、合并多余空格
  - 去掉末尾标点（`?？。！` 等）
  - 不动语义词，**保留**「为什么 / 怎么 / 如何」等，用于意图判断

- **意图识别（detectIntent）**
  - 输入：`cleanedQuery`
  - 输出：`intent`、`intentScore`、可选 `intentReason`
  - 典型意图值：`'kb_consult' | 'content_generate' | 'small_talk' | 'fallback'`

- **语义归一化（semanticNormalize）**
  - 输入：`cleanedQuery`
  - 去掉前缀/语气停用词（如「请问」「我想问」「为什么」「怎么」「如何」等）
  - 去掉句尾语气助词（如「呢」「吗」「啊」「呀」「吧」）
  - 输出：`normalizedQuery`，用于 **精确匹配 + 向量检索**

- **路由与调用**
  - `intent === 'kb_consult'`：走现有 `kbAskService`（静态规则 → 精确匹配 → 向量检索 + LLM）
  - `intent === 'content_generate'`：走通用生成链路（写作 / 改写 / 续写等）
  - 其他意图：按需要路由到闲聊或兜底回答

---

### 3. 与「统一入口」的结合方式

定义一个统一预处理函数，只在入口调用一次：

```ts
function preprocessForEntry(rawQuery: string): PreprocessResult {
  const raw = (rawQuery || '').trim();
  const cleaned = lightClean(raw);                 // 给意图判断用
  const { intent, score } = detectIntent(cleaned); // 咨询 / 生成 / 其他
  const normalized = semanticNormalize(cleaned);   // 给检索 / 向量用

  return { raw, cleaned, normalized, intent, intentScore: score };
}
```

- 统一入口只调用这一个函数。
- 下游模块：
  - **意图路由、日志分析** 使用 `cleaned`
  - **精确匹配、向量检索** 使用 `normalized`

这样逻辑上仍是“两层预处理”，实现上只在入口调一次，避免到处重复处理 `query`。

---

### 4. 统一入口 API 设计

#### 4.1 接口说明

- **HTTP**：`POST /api/ai/entry`（示例路径，可按现有路由调整）

- **Body 示例**

```json
{
  "query": "请问这个平台怎么使用？",
  "language_code": "zh-CN",
  "role": "teacher",
  "channel": "help_page"
}
```

- **Response 示例**

```json
{
  "success": true,
  "intent": "kb_consult",
  "intent_score": 0.92,
  "answer": "……",
  "source_type": "vector",        // static | exact | vector | generate
  "source": { },
  "sources": [ ],
  "recommend": [ ]
}
```

---

### 5. 统一预处理函数

#### 5.1 类型定义

```ts
type PreprocessResult = {
  raw: string;         // 原始输入
  cleaned: string;     // 轻度清洗后（给意图用）
  normalized: string;  // 语义归一化后（给检索/向量用）
  intent: string;      // kb_consult / content_generate / ...
  intentScore: number; // 0~1 置信度
};
```

#### 5.2 实现要点（伪代码）

```ts
function lightClean(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[？?！!。]+$/g, '')
    .trim();
}

const PREFIX_STOP_WORDS = [
  '请问', '我想问', '想了解', '想咨询',
  '能不能', '可以不可以', '麻烦', '帮我',
  '为什么', '怎么', '如何',
];

const SUFFIX_STOP_CHARS = ['呢', '吗', '啊', '呀', '吧'];

function semanticNormalize(cleaned: string): string {
  let q = cleaned;

  // 去前缀
  for (const p of PREFIX_STOP_WORDS) {
    if (q.startsWith(p)) {
      q = q.slice(p.length).trim();
      break;
    }
  }

  // 去句尾语气词（仅最后一个）
  if (q.length > 1 && SUFFIX_STOP_CHARS.includes(q[q.length - 1])) {
    q = q.slice(0, -1);
  }

  return q || cleaned; // 避免删成空
}

function detectIntent(cleaned: string) {
  const q = cleaned.toLowerCase();

  // 简单规则示例，可后续替换为分类模型
  if (q.includes('价格') || q.includes('收费') || q.includes('多少钱')) {
    return { intent: 'kb_consult', score: 0.9 };
  }

  if (q.includes('写') && q.includes('文案')) {
    return { intent: 'content_generate', score: 0.9 };
  }

  // 默认视为产品咨询
  return { intent: 'kb_consult', score: 0.6 };
}

function preprocessForEntry(rawQuery: string): PreprocessResult {
  const raw = (rawQuery || '').trim();
  const cleaned = lightClean(raw);
  const { intent, score } = detectIntent(cleaned);
  const normalized = semanticNormalize(cleaned);
  return { raw, cleaned, normalized, intent, intentScore: score };
}
```

---

### 6. 与现有模块的对接

- **`/api/kb/ask`**
  - 未来可以改为只接收 `normalizedQuery`，由统一入口调用：
    - `kbAskService.staticRulesMatch(preprocessed.normalized, language_code)`
    - `kbAskService.exactMatch(..., preprocessed.normalized, ...)`
    - `getEmbedding(preprocessed.normalized)`

- **通用生成模块**
  - 直接使用 `cleaned` 或 `raw`，保留更多语气和风格信息。

---

### 7. 后续优化方向

- 把 `detectIntent` 从规则版升级为轻量级分类模型（多标签：咨询 / 生成 / 投诉 / 报错日志等）。
- 日志中记录 `raw / cleaned / normalized / intent / source_type`，定期查看：
  - 哪些 `query` 经常落到兜底；
  - 哪些前缀 / 问法最常见，据此调整停用词表和静态规则。
