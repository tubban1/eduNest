# AI 内容类型系统设计文档

## 概述

本系统支持两种输出类型（Output Type），用户可以通过下拉框选择不同的输出形式。默认使用交互式形式（Vue 3 交互式教育项目），也可以选择动画形式（连续动画可视化）。

## 输出类型定义

### 1. 交互式形式（interactive）- 默认

**类型标识：** `interactive`

**描述：** 使用 Vue 3 构建的交互式教育项目，支持多阶段、用户交互、实时反馈等。

**特点：**
- 多阶段界面（使用 v-if）
- 丰富的用户交互（滑块、拖拽、点击等）
- 实时视觉和音频反馈
- 支持数学公式渲染（KaTeX）
- 支持 Canvas、Three.js 等可视化库

**系统提示词：** 统一的 `UNIFIED_SYSTEM_PROMPT`（见下文）

**用户提示词：** `INTERACTIVE_USER_PROMPTS`（见下文）

### 2. 动画形式（animated）

**类型标识：** `animated`

**描述：** 连续动画可视化，类似完整视频，从开始到结束自动播放，结束后平滑回到初始状态。

**特点：**
- 连续动画，无需用户交互（除了开始播放）
- 自动播放和旁白
- 平滑的过渡和返回动画
- 字幕支持
- 2K 分辨率
- 专业级视觉质量

**系统提示词：** 统一的 `UNIFIED_SYSTEM_PROMPT`（见下文）

**用户提示词：** `ANIMATED_USER_PROMPTS`（见下文）

## 简单模式规范

交互式内容统一用「骨架填空」：`aiService.js` 中 `INTERACTIVE_CODE_FRAMEWORK` 为最简骨架，AI 只填占位符，不改结构。SimpleModeChecker 会拦截 MutationObserver、renderMathInElement(document.body)、MathRenderManager、mount('body') 等违规。

## 实现方案

### 1. 设计原则

**动态系统提示词 + 差异化用户提示词**

- **系统提示词：** 根据 `output_type` 动态生成，只包含通用部分 + 当前类型的特定要求（不包含其他类型的配置，节省 token）
- **用户提示词：** 根据 `output_type` 选择不同的用户提示词模板，明确指定输出类型和特定要求

### 2. 数据结构

```javascript
// 输出类型配置
const OUTPUT_TYPE_CONFIGS = {
  interactive: {
    name: '交互式',
    name_en: 'Interactive',
    description: 'Vue 3 交互式教育项目，支持多阶段和丰富交互',
    userPrompt: INTERACTIVE_USER_PROMPTS,
    default: true
  },
  animated: {
    name: '动画',
    name_en: 'Animated',
    description: '连续动画可视化，自动播放，类似视频体验',
    userPrompt: ANIMATED_USER_PROMPTS,
    default: false
  }
};

// 注意：两种类型共用 UNIFIED_SYSTEM_PROMPT
```

### 3. 动态系统提示词定义

#### 3.1 系统提示词结构

系统提示词由两部分组成：
1. **通用部分（COMMON_SYSTEM_PROMPT）**：所有输出类型都需要的通用要求和规范
2. **类型特定部分（TYPE_SPECIFIC_PROMPTS）**：根据 `output_type` 动态添加的特定配置

根据 `output_type` 动态组合生成，只包含当前类型需要的部分：

```javascript
// 1. 通用部分（所有输出类型都需要，只有这部分是 interactive 和 animated 都一样的）
const COMMON_SYSTEM_PROMPT = {
  "svg_generation_requirements": {
    "output_field": "svg",
    "coordinate_system": "viewBox=\"0 0 640 360\"",
    "size_attributes": {
      "width": "FORBIDDEN",
      "height": "FORBIDDEN"
    },
    "scaling": "Rely on default preserveAspectRatio=\"xMidYMid meet\"",
    "rules": [
      "SVG must be fully self-contained",
      "No external fonts, images, scripts, or CSS",
      "No JavaScript inside SVG",
      "Deterministic output only",
      "Use abstract diagrams or symbolic representations"
    ]
  },
  
  "output_format_requirements": {
    "format": "single JSON object only",
    "parsing_rule": "The entire output MUST be valid, strictly parseable JSON. Any missing comma, unclosed quote, or bracket is a critical error.",
    "language_consistency": [
      "language_code is {{fallback_language}}.",
      "ALL text values in the JSON (including title, description, UI strings, tags, and comments) MUST match the language indicated by language_code."
    ]
  },
  
  "output_schema": {
    "title": "Concise educational project title in the target language",
    "description": "Clear explanation of what is taught",
    "knowledge_points": {
      "type": "JSON array of strings",
      "count": "1-3",
      "rules": [
        "Content-oriented: core conceptual keywords (e.g. 'conservation of energy', 'slope of tangent').",
        "No platform/UI/grade labels."
      ]
    },
    "full_html": "A complete, standalone HTML document including all CSS and JS",
    "svg": "A self-contained SVG thumbnail following the SVG rules",
    "tags": {
      "type": "JSON array of strings",
      "count": "3-7",
      "rules": [
        "Index-oriented: for search/filter (subject, grade, exam, topic).",
        "Can include curriculum labels (e.g., 'High School Physics', 'Gaokao', 'AP Calculus')."
      ]
    },
    "content_type": "{{content_type}}",
    "tech_stack": {
      "type": "JSON array of strings",
      "description": "List of main technologies/frameworks actually used",
      "rules": [
        "Include all major libraries and frameworks used (e.g., ['Vue 3', 'KaTeX'] or ['GSAP', 'Canvas'])"
      ]
    },
    "language_code": "{{fallback_language}}"
  },
  
  "final_instruction": "Return ONLY the final JSON object that exactly matches the schema above. Do not include any additional text."
};

// 2. 类型特定部分（根据 output_type 动态添加）
const TYPE_SPECIFIC_PROMPTS = {
  interactive: {
    "identity": "You are an expert Vue 3 educational interaction designer and senior frontend engineer.",
    
    "core_objective": "Generate a production-safe, highly interactive Vue 3 educational project that teaches the requested topic clearly and deeply.",
    
    "platform_philosophy": {
      "learning_model": "This platform prioritizes interactive, visual, and exploratory learning.",
      "interaction_priority": [
        "When interaction, animation, simulation, or sound improves understanding, YOU SHOULD implement it.",
        "Purely static text explanations are insufficient unless interaction adds no educational value.",
        "Learner agency, experimentation, and feedback are core goals."
      ],
      "audio_policy": [
        "Sound effects (audio cues) are encouraged when they support learning.",
        "Speech synthesis (Web Speech API) MUST be triggered only by explicit user interaction (e.g., button click).",
        "Automatic narration on load or stage change is strictly forbidden."
      ]
    },
    
    "pedagogical_requirements": {
      "depth": "Explain the concept accurately and deeply; avoid superficial summaries.",
      "structure": [
        "Core principles and their relationships",
        "Progressive scaffolding from intuition to formal understanding",
        "Common misconceptions or edge cases when relevant"
      ],
      "reinforcement": [
        "Interactive manipulation or simulation",
        "Clear visual metaphors",
        "Immediate visual or audio feedback when helpful"
      ],
      "accuracy": "All visuals, diagrams, and representations must be conceptually and factually accurate."
    },
    
    "technical_constraints": {
      "html": {
        "standalone": true,
        "must_include": [
          "<!DOCTYPE html>",
          "<meta charset=\"UTF-8\">",
          "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
        ]
      },
      "vue": {
        "version": "3.5.20",
        "loading": "production CDN only",
        "api": "Composition API preferred (ref, reactive, computed, watch, onMounted, nextTick)",
        "ui_rules": [
          "Multi-stage interfaces MUST use v-if only",
          "Only one stage/page may exist in the DOM at any time",
          "DO NOT use v-show, opacity, or visibility to hide content"
        ]
      },
      "dom_safety": {
        "canvas_and_dom": [
          "All DOM-dependent logic (Canvas, Three.js, audio, Web Speech) MUST run only after the element exists in the DOM.",
          "Do NOT assume DOM elements persist across v-if stage changes."
        ],
        "math_rendering": [
          "ALL mathematical formulas MUST be rendered using KaTeX. Raw LaTeX text MUST NOT appear in the final UI.",
          "For static HTML text content, wrap formulas in $ for inline formulas (e.g., $x^2 + y^2 = z^2$) and $$ for block formulas.",
          "CRITICAL: When calling renderMathInElement, you MUST configure delimiters to match the delimiters used in HTML.",
          "For the v-katex directive, the input string MUST NOT include $ or $$ delimiters.",
          "CRITICAL: When writing LaTeX formulas in JavaScript strings, ALL backslashes MUST be double-escaped.",
          "The generated code MUST guarantee formulas are correctly rendered after every DOM update or stage change."
        ]
      },
      "libraries_policy": [
        "External libraries MAY be used when they clearly improve pedagogy or interaction.",
        "Avoid libraries that are purely decorative or redundant.",
        "All dependencies MUST be loaded via production CDN (unpkg / jsdelivr / cdnjs)."
      ]
    },
    
    "ux_ui_requirements": {
      "responsive": true,
      "touch_friendly": true,
      "design_focus": [
        "Clarity over decoration",
        "Interaction clarity over visual complexity"
      ]
    }
  },
  
  animated: {
    "identity": "You are an expert educational animation director and frontend engineer.",
    
    "task_type": "animated_educational_visualization",
    
    "core_objective": "Generate a production-safe, continuous animated educational visualization that explains the requested topic clearly through a complete visual narrative.",
    
    "director_perspective": {
      "approach": "Think like a filmmaker creating an educational animation film. Plan the visual narrative, camera movements, scene transitions, and storytelling rhythm.",
      "focus": "Create a compelling visual story that explains the concept through animation, not through technical implementation details.",
      "storytelling_structure": {
        "beginning": "Introduce the context and set up the visual story",
        "middle": "Progressively reveal the concept through animated sequences step by step",
        "ending": "Conclude the idea visually, then smoothly return to the initial state"
      },
      "transitions": "Use smooth, cinematic transitions between scenes, including the return-to-start transition (smooth rewind or fade-back, not abrupt reset)."
    },
    
    "presentation_style": {
      "format": "continuous animation",
      "experience": "Like a complete video that progresses from beginning to end after user interaction.",
      "interaction": {
        "buttons": "No learning interaction buttons.",
        "allowed_control": [
          "A single click to start playback and narration",
          "A sound toggle to mute or unmute narration"
        ],
        "start_policy": "Playback and narration begin ONLY after user click."
      }
    },
    
    "playback_behavior": {
      "end_behavior": {
        "action": "Return to the initial visual state after the animation finishes.",
        "looping": {
          "auto_loop": false,
          "state": "After returning to the start, the animation remains paused until the user initiates playback again."
        }
      }
    },
    
    "visual_design": {
      "overall_quality": "Extremely polished, elegant, and professional - looks like a professionally produced educational animation, not a demo.",
      "design_sense": "Strong sense of layout, rhythm, and visual storytelling.",
      "color_scheme": "Light, harmonious, widely accepted pastel or soft color palette.",
      "visual_elements": "Rich and varied visual elements that support understanding, not decoration.",
      "accuracy": "All visuals, diagrams, and representations must be conceptually and factually accurate."
    },
    
    "narration_and_audio": {
      "narration_style": "Calm, explanatory narration that matches the pace of the animation.",
      "audio_control": {
        "mute_option": true,
        "default_state": "muted until user interaction",
        "user_control": "User can toggle narration sound on or off at any time."
      },
      "text_sync": {
        "behavior": "On-screen narration text is highlighted or revealed in sync with spoken audio.",
        "purpose": "Reinforce understanding through audio-visual alignment."
      }
    },
    
    "subtitle_and_text": {
      "style": "Narration-style explanatory text.",
      "coverage": "From start to finish, the narration text fully explains the topic.",
      "subtitle": {
        "language": "{{fallback_language}}",
        "placement": "Carefully positioned to avoid blocking important visuals or key graphics",
        "readability": "Clear, legible, and visually integrated into the scene"
      }
    },
    
    "layout_and_resolution": {
      "container_resolution": "2K resolution",
      "layout_rules": [
        "All elements must be correctly positioned within the 2K container",
        "No overlapping, clipping, or visual collision",
        "All spatial relationships should enhance clarity"
      ]
    },
    
    "technical_constraints": {
      "html": {
        "standalone": true,
        "must_include": [
          "<!DOCTYPE html>",
          "<meta charset=\"UTF-8\">",
          "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
        ],
        "deliverable": "Single self-contained HTML file",
        "includes": [
          "HTML",
          "CSS",
          "JavaScript",
          "SVG graphics"
        ],
        "structure_rule": "All code must be embedded into one HTML file."
      },
      "animation_policy": {
        "timeline_controller": "GSAP (mandatory)",
        "allowed_rendering_layers": [
          "DOM + CSS",
          "SVG",
          "Canvas",
          "Three.js / WebGL"
        ],
        "rules": [
          "GSAP MUST control the overall animation timeline and stage transitions",
          "Specialized libraries MAY be used when GSAP is not technically suitable",
          "No animation sequencing via setTimeout or setInterval",
          "All animations MUST support a clean reset to the initial state and return deterministically to the starting frame"
        ]
      }
    },
    
    "quality_bar": {
      "educational": "Knowledge is conveyed clearly, accurately, and coherently.",
      "experience": "Pleasant to watch from start to finish without confusion or distraction."
    }
  }
};

// 3. 动态生成系统提示词函数
const getSystemPrompt = (knowledgePoint, languageCode, outputType) => {
  // 深拷贝通用部分
  const systemPrompt = JSON.parse(JSON.stringify(COMMON_SYSTEM_PROMPT));
  
  // 根据 output_type 添加特定配置
  const typeSpecific = TYPE_SPECIFIC_PROMPTS[outputType];
  if (typeSpecific) {
    // 合并所有特定配置（包括 platform_philosophy, visual_design, ux_ui_requirements, technical_constraints 等）
    Object.keys(typeSpecific).forEach(key => {
      if (key === 'technical_constraints') {
        // technical_constraints 需要合并到现有的 technical_constraints 中
        systemPrompt.technical_constraints = {
          ...systemPrompt.technical_constraints,
          ...typeSpecific.technical_constraints
        };
      } else if (key === 'pedagogical_requirements') {
        // pedagogical_requirements 需要合并到现有的 pedagogical_requirements 中
        systemPrompt.pedagogical_requirements = {
          ...systemPrompt.pedagogical_requirements,
          ...typeSpecific.pedagogical_requirements
        };
      } else {
        // 其他配置直接添加
        systemPrompt[key] = typeSpecific[key];
      }
    });
  }
  
  // 替换占位符
  let promptStr = JSON.stringify(systemPrompt, null, 2);
  promptStr = safeReplace(promptStr, '{{knowledge_point}}', knowledgePoint);
  promptStr = safeReplace(promptStr, '{{fallback_language}}', languageCode || 'en-US');
  promptStr = safeReplace(promptStr, '{{content_type}}', outputType); // outputType 本身就是 'interactive' 或 'animated'
  
  return promptStr;
};
```

**关键设计点：**
1. **通用部分（COMMON_SYSTEM_PROMPT）**：只有这部分是 interactive 和 animated 都一样的
   - `svg_generation_requirements`：SVG 生成规则
   - `output_format_requirements`：JSON 输出格式要求
   - `output_schema`：输出数据结构定义
   - `final_instruction`：最终指令
   
2. **类型特定部分（TYPE_SPECIFIC_PROMPTS）**：根据 `output_type` 动态添加的特定配置
   - **interactive**：身份、核心目标、平台理念、教学要求、技术约束（HTML、Vue、DOM 安全、数学渲染、库策略）、UX/UI 要求
   - **animated**：身份、核心目标、导演视角、教学要求、叙事结构、视觉叙事、技术约束（HTML、格式、交互、分辨率、库）
   
3. **动态生成（getSystemPrompt）**：根据 `output_type` 组合通用部分和特定部分，只包含当前类型需要的配置
4. **节省 token**：每次请求只包含当前输出类型需要的配置，不包含其他类型的配置
5. **职责分离**：
   - **System Prompt**：定义技术规范、输出格式、约束条件
   - **User Prompt**：定义教学目标和内容要求，不重复技术细节

### 4. 用户提示词模板

#### 4.1 交互式用户提示词

明确指定输出类型为 `interactive`，并包含所有交互式特定的要求：

```javascript
const INTERACTIVE_USER_PROMPTS = `Create an interactive educational project that teaches "{{knowledge_point}}".

Help learners deeply understand it through interactive exploration. Let users explore in steps, with interactions that reveal relationships and insights. Show how it connects to broader ideas and real-world applications. End with reflection or synthesis, helping learners see the "big picture" of how it fits within a wider knowledge network and connects to related concepts.`;
```

#### 4.2 动画用户提示词

明确指定输出类型为 `animated`，只强调核心教学目标（技术细节已在 system prompt 中详细说明）：

```javascript
const ANIMATED_USER_PROMPTS = `Create an animated visualization that explains "{{knowledge_point}}" through a complete visual narrative.

The animation should help viewers understand the full process and core idea without additional explanation.`;
```

### 5. API 接口修改

#### 5.1 生成接口参数

在 `generateEducationalContent` 函数中，将 `learningStage` 参数改为 `outputType`：

```javascript
const generateEducationalContent = async (
  knowledgePoint,
  outputType = 'interactive', // 改为 outputType，默认为 interactive
  description = '',
  languageCode = '',
  userId = null,
  actionType = 'generate',
  provider = null,
  requestId = null,
  isAsyncMode = false,
  image = null
) => {
  // 动态生成系统提示词（只包含当前类型需要的配置）
  const systemPrompt = getSystemPrompt(knowledgePoint, languageCode, outputType);
  
  // 根据 outputType 选择对应的用户提示词
  const config = OUTPUT_TYPE_CONFIGS[outputType] || OUTPUT_TYPE_CONFIGS.interactive;
  const userPromptTemplate = config.userPrompt;
  const userPrompt = safeReplace(userPromptTemplate, '{{knowledge_point}}', knowledgePoint);
  
  // ... 后续逻辑
};
```

#### 5.2 前端接口调用

前端需要传递 `output_type` 参数（不再需要 `learning_stage`）：

```typescript
// 前端 API 调用示例
const generateContent = async (params: {
  knowledge_point: string;
  output_type?: 'interactive' | 'animated'; // 改为 output_type，替代 learning_stage
  // ... 其他参数
}) => {
  return await api.post('/ai/generate', params);
};
```

### 6. 前端 UI 修改

#### 6.1 输出类型选择器

在内容生成表单中添加下拉框（替代原来的学习阶段选择器），需要适配多语言：

```tsx
const { t } = useTranslation(['content', 'common']);

<select
  value={outputType}
  onChange={(e) => setOutputType(e.target.value)}
>
  <option value="interactive">
    {t('outputType.interactive', { ns: 'content', defaultValue: 'Interactive (Default)' })}
  </option>
  <option value="animated">
    {t('outputType.animated', { ns: 'content', defaultValue: 'Animated' })}
  </option>
</select>
```

#### 6.2 类型说明

为每种类型添加说明文字（需要适配多语言）：

```tsx
<div className="output-type-description">
  {outputType === 'interactive' ? (
    <p>{t('outputType.interactiveDescription', { 
      ns: 'content', 
      defaultValue: 'Supports multi-stage interactions, real-time feedback, and rich user operations' 
    })}</p>
  ) : (
    <p>{t('outputType.animatedDescription', { 
      ns: 'content', 
      defaultValue: 'Continuous animation playback, video-like experience, auto-play and narration' 
    })}</p>
  )}
</div>
```

**多语言翻译键（需要在 `content.json` 中添加）：**

```json
{
  "outputType": {
    "interactive": "交互式（默认）",
    "animated": "动画",
    "interactiveDescription": "支持多阶段交互、实时反馈、丰富的用户操作",
    "animatedDescription": "连续动画播放，类似视频体验，自动播放和旁白"
  }
}
```

英文版本（`en-US/content.json`）：
```json
{
  "outputType": {
    "interactive": "Interactive (Default)",
    "animated": "Animated",
    "interactiveDescription": "Supports multi-stage interactions, real-time feedback, and rich user operations",
    "animatedDescription": "Continuous animation playback, video-like experience, auto-play and narration"
  }
}
```

### 7. 数据库字段

确保 `content` 表的字段支持新类型：

**`content_type` 字段：**
- `vue`（兼容旧数据，映射到 `interactive`）
- `interactive`（交互式输出类型）
- `animated`（动画输出类型）

**`tech_stack` 字段（新增）：**
- 类型：`JSONB`（PostgreSQL）或 `JSON`（其他数据库）
- 格式：JSON 数组，如 `["Vue 3", "KaTeX", "Canvas"]` 或 `["GSAP", "Canvas", "Three.js"]`
- 用途：记录内容实际使用的主要技术栈/框架
- 可为 NULL（兼容现有数据）

**字段说明：**
- `content_type`：功能类型标识符，只表示输出类型（`interactive` 或 `animated`），不涉及技术栈
- `tech_stack`：技术栈数组，记录实际使用的技术栈，便于查询、分析和展示
- 这样设计的好处：`content_type` 更简洁统一，技术栈信息由 `tech_stack` 单独记录

**RenderEngine 检查策略：**
- **依据 `content_type` 决定检查器**（不依据 `tech_stack`）：
  - `interactive` → 运行 `['math', 'runtime', 'eslint', 'library']`（包含 Vue 专用检查）
  - `animated` → 运行 `['math', 'library']`（不包含 Vue 专用检查）
- **为什么用 `content_type` 而不是 `tech_stack`？**
  1. **Prompt 保证**：根据 `TYPE_SPECIFIC_PROMPTS`，`interactive` 类型一定包含 Vue（prompt 明确要求），`animated` 类型不包含 Vue
  2. **简单可靠**：`content_type` 是功能类型标识符，值固定（`interactive` 或 `animated`），判断逻辑简单
  3. **避免误判**：`tech_stack` 是 AI 自由输出，可能存在格式不一致、遗漏或错误，不适合用于关键决策
  4. **职责分离**：`content_type` 用于系统行为（检查策略），`tech_stack` 用于元数据展示和分析

**数据库迁移：**
执行 `edu/backend/migrations/add_tech_stack_to_content.sql` 来添加 `tech_stack` 字段。

### 8. 实现步骤

1. **阶段 1：动态系统提示词**
   - 在 `aiService.js` 中定义 `COMMON_SYSTEM_PROMPT`（通用部分）
   - 定义 `TYPE_SPECIFIC_PROMPTS`（类型特定部分，包含 `interactive` 和 `animated`）
   - 创建 `getSystemPrompt` 函数，根据 `output_type` 动态组合生成系统提示词

2. **阶段 2：用户提示词模板**
   - 定义 `INTERACTIVE_USER_PROMPTS`，在开头添加 `OUTPUT TYPE: interactive`
   - 定义 `ANIMATED_USER_PROMPTS`，在开头添加 `OUTPUT TYPE: animated`
   - 确保用户提示词明确指定类型和所有特定要求

3. **阶段 3：数据结构定义**
   - 在 `aiService.js` 中定义 `OUTPUT_TYPE_CONFIGS`（只包含用户提示词，不包含系统提示词）
   - 创建 `getUnifiedSystemPrompt` 函数，用于替换占位符

4. **阶段 4：函数修改**
   - 修改 `generateEducationalContent` 函数，将 `learningStage` 参数改为 `outputType`
   - 使用 `getSystemPrompt` 动态生成系统提示词（只包含当前类型需要的配置）
   - 根据 `outputType` 选择对应的用户提示词

5. **阶段 5：API 接口**
   - 修改 `/api/ai/generate` 接口，接收 `output_type` 参数（替代 `learning_stage`）
   - 传递参数到 `generateEducationalContent`

6. **阶段 6：前端 UI**
   - 在内容生成表单中将学习阶段选择器改为输出类型选择器
   - 添加类型说明和预览

7. **阶段 7：测试和优化**
   - 测试两种输出类型的生成
   - 优化提示词，确保输出质量
   - 处理边界情况和错误

### 9. 注意事项

1. **向后兼容：** 默认使用 `interactive`，确保现有功能不受影响
2. **动态系统提示词：** 系统提示词根据 `output_type` 动态生成，只包含通用部分 + 当前类型的特定配置，不包含其他类型的配置（节省 token）
3. **用户提示词明确性：** 用户提示词必须在开头明确指定 `OUTPUT TYPE`，并包含该类型的所有特定要求
4. **占位符替换：** 在 `getSystemPrompt` 中正确替换 `{{content_type}}` 占位符（直接使用 `outputType` 的值：`interactive` 或 `animated`）
5. **参数变更：** `learningStage` 参数已移除，改为 `outputType`，前端需要相应调整
6. **输出验证：** 确保两种输出类型的输出都符合各自的规范
7. **用户体验：** 在 UI 中清晰说明两种类型的区别和适用场景
8. **Token 优化：** 每次请求只包含当前输出类型需要的配置，可以显著节省 token 使用量

### 10. 扩展性

未来可以轻松添加更多输出类型：

```javascript
const OUTPUT_TYPE_CONFIGS = {
  interactive: { ... },
  animated: { ... },
  // 未来可以添加：
  // interactive_simulation: { ... },
  // quiz_game: { ... },
  // etc.
};
```

## 总结

本方案采用**动态系统提示词 + 差异化用户提示词**的设计：

1. **动态系统提示词：** 
   - `COMMON_SYSTEM_PROMPT` 包含所有输出类型的通用要求（平台理念、教学要求、视觉设计等）
   - `TYPE_SPECIFIC_PROMPTS` 包含各类型的特定技术约束
   - `getSystemPrompt` 函数根据 `output_type` 动态组合，只包含当前类型需要的配置（节省 token）

2. **差异化用户提示词：** 根据 `output_type` 选择不同的用户提示词，每个提示词在开头明确指定 `OUTPUT TYPE`，并包含该类型的所有特定要求

3. **输出类型：** 系统支持两种输出类型：
   - `interactive`：Vue 3 交互式教育项目（默认）
   - `animated`：连续动画可视化

4. **优势：**
   - **节省 token**：每次请求只包含当前输出类型需要的配置，不包含其他类型的配置
   - 减少重复：通用要求只需维护一份
   - 易于扩展：添加新类型只需在 `TYPE_SPECIFIC_PROMPTS` 中添加配置，并创建对应的用户提示词
   - 清晰明确：用户提示词明确指定类型，AI 不会混淆
   - 简化选择：不再需要选择学习阶段，只需选择输出类型

用户可以通过下拉框选择不同的输出类型，系统会根据选择动态生成系统提示词（只包含该类型需要的配置），并使用对应的用户提示词，生成符合规范的内容。
