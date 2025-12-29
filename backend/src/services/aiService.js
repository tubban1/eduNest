const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { logAIUsage } = require('./database');
const express = require('express');
const router = express.Router();
const { supabase } = require('./database');
const AIProviderFactory = require('./aiProviderFactory');

// loadSupportedLibraries 函数已删除（不再需要，因为已切换到 full_html 模式）

// 抽象的AI使用日志记录方法
const logAIUsageWithDefaults = async (params) => {
  const defaultParams = {
    user_id: null,
    model_name: null,
    user_query: '',
    action_type: 'unknown',
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    request_payload: null,
    response_metadata: null,
    created_at: new Date(),
    is_json_valid: false,
    is_render_success: false,
    error_message: null,
    request_id: null
  };
  
  const logParams = { ...defaultParams, ...params };
  return await logAIUsage(logParams);
};

// 更新现有的AI使用日志记录
const updateExistingLog = async (requestId, updateData) => {
  try {
    // 使用已导入的 supabase 客户端
    const { error } = await supabase
      .from('ai_usage_logs')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId);

    if (error) {
      console.error('更新AI使用日志失败:', error);
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('更新AI使用日志失败:', error);
    return { success: false, error };
  }
};

// 安全的变量替换函数
const safeReplace = (template, placeholder, value) => {
  if (typeof value !== 'string') {
    value = String(value);
  }
  
  // 只转义必要的特殊字符，防止 JSON 注入和模板破坏
  const escapedValue = value
    .replace(/\\/g, '\\\\')  // 反斜杠
    .replace(/"/g, '\\"')    // 双引号
    .replace(/'/g, "\\'")    // 单引号
    .replace(/\n/g, '\\n')   // 换行符
    .replace(/\r/g, '\\r')   // 回车符
    .replace(/\t/g, '\\t');  // 制表符
  
  // 使用正则表达式进行全局替换，转义正则表达式特殊字符
  const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return template.replace(new RegExp(escapedPlaceholder, 'g'), escapedValue);
};

const supportedLibrariesPath = path.join(__dirname, '../..', 'config', 'supported-libraries.json');
const fallbackLibrariesPath = path.join(__dirname, '../..', 'config', 'libraries_cn.json');

const loadJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('[aiService] Library config not found:', filePath);
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[aiService] Failed to load JSON config:', filePath, error);
    return null;
  }
};

const buildLibraryEntries = (config) => {
  if (!config || !config.libraries) return [];
  const entries = [];
  for (const [name, details] of Object.entries(config.libraries)) {
    const basePatterns = Array.isArray(details.patterns) ? details.patterns : [];
    const addEntry = (type, url, patterns = basePatterns) => {
      if (!url) return;
      entries.push({
        name,
        type,
        url,
        patterns: Array.isArray(patterns) ? patterns : []
      });
    };

    if (details.versions) {
      const versionUrl = Object.values(details.versions)[0];
      addEntry('js', versionUrl);
    }

    if (details.css) {
      const cssUrl = Object.values(details.css)[0];
      addEntry('css', cssUrl);
    }

    if (details.extras) {
      for (const [extraName, extraDetails] of Object.entries(details.extras)) {
        const extraUrl = extraDetails?.versions ? Object.values(extraDetails.versions)[0] : null;
        const extraPatterns = extraDetails?.patterns?.length ? extraDetails.patterns : basePatterns;
        addEntry('js', extraUrl, extraPatterns);
      }
    }
  }
  return entries;
};

let supportedLibraryEntriesCache = null;
let fallbackLibraryEntriesCache = null;

const getSupportedLibraryEntries = () => {
  if (!supportedLibraryEntriesCache) {
    supportedLibraryEntriesCache = buildLibraryEntries(loadJsonFile(supportedLibrariesPath));
  }
  return supportedLibraryEntriesCache;
};

const getFallbackLibraryEntries = () => {
  if (!fallbackLibraryEntriesCache) {
    fallbackLibraryEntriesCache = buildLibraryEntries(loadJsonFile(fallbackLibrariesPath));
  }
  return fallbackLibraryEntriesCache;
};

const findReplacementUrl = (url, type) => {
  if (!url || typeof url !== 'string') return null;

  const matchFromEntries = (entries) => {
    if (!entries || !entries.length) return null;
    for (const entry of entries) {
      if (entry.type !== type) continue;
      if (!entry.patterns || !entry.patterns.length) continue;
      if (entry.patterns.some(pattern => pattern && url.includes(pattern))) {
        if (entry.url && entry.url !== url) {
          return entry.url;
        }
      }
    }
    return null;
  };

  return (
    matchFromEntries(getSupportedLibraryEntries()) ||
    matchFromEntries(getFallbackLibraryEntries())
  );
};

const replaceLibrariesInHtml = (html) => {
  if (typeof html !== 'string' || !html.trim()) return html;

  let updatedHtml = html;

  // 替换 <script src="...">，优先使用 supported-libraries，失败回退到 libraries_cn（通过 onerror）
  updatedHtml = updatedHtml.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (match, beforeAttrs, src, afterAttrs) => {
      const primary = findReplacementUrl(src, 'js'); // supported
      const fallback = (() => {
        // 显式从 fallback 表里匹配
        const entries = getFallbackLibraryEntries();
        if (!entries || !entries.length) return null;
        for (const entry of entries) {
          if (entry.type !== 'js') continue;
          if (entry.patterns && entry.patterns.some(p => p && src.includes(p))) {
            return entry.url;
          }
        }
        // 若 primary 命中了 supported，也尝试用相同库名在 fallback 找到对应 URL（模式匹配不足时）
        if (primary) {
          for (const entry of entries) {
            if (entry.type === 'js' && entry.url) {
              // 简单启发：同名库（根据 url 最后一段文件名判断）
              const file = primary.split('/').pop();
              const fbFile = entry.url.split('/').pop();
              if (file && fbFile && file.toLowerCase().includes(fbFile.split('?')[0].toLowerCase().replace(/\.min\.js$|\.js$/,''))) {
                return entry.url;
              }
            }
          }
        }
        return null;
      })();

      // 重建 <script> 标签
      const leftAttrs = beforeAttrs || '';
      const rightAttrs = afterAttrs || '';

      if (primary) {
        if (fallback && !/onerror=/i.test(match)) {
          return `<script${leftAttrs} src="${primary}" onerror="this.onerror=null; this.src='${fallback}'"${rightAttrs}></script>`;
        }
        return `<script${leftAttrs} src="${primary}"${rightAttrs}></script>`;
      }

      // 若未匹配到 supported，但能匹配到 fallback，直接使用 fallback
      if (fallback) {
        return `<script${leftAttrs} src="${fallback}"${rightAttrs}></script>`;
      }

      // 未匹配到任何替换，保持原样
      return match;
    }
  );

  // 替换 <link href="...">
  updatedHtml = updatedHtml.replace(
    /<link\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (match, beforeAttrs, href, afterAttrs) => {
      const relMatch = match.match(/\brel=["']([^"']+)["']/i);
      const rel = relMatch ? relMatch[1].toLowerCase() : '';
      if (rel && rel !== 'stylesheet' && rel !== 'preload' && rel !== 'prefetch') {
        return match;
      }
      const primary = findReplacementUrl(href, 'css');
      if (primary) {
        return `<link${beforeAttrs || ''} href="${primary}"${afterAttrs || ''}>`;
      }
      return match;
    }
  );

  return updatedHtml;
};

// AI服务配置
const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_MODEL = process.env.ARK_MODEL || 'kimi-k2-250905';
const ARK_URL = process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 初始化AI提供商工厂
const aiProviderFactory = new AIProviderFactory();

// 系统提示词（来自AI_KNOWLEDGE.md）
const SYSTEM_PROMPT = `You are an expert Vue 3 educational interaction designer and frontend engineer.

Your task is to generate an interactive Vue 3 project that visually, audibly, and interactively teaches a specific concept.

Your design must ensure:

1. Educational Quality
- The input "{{knowledge_point}}" must be accurately and deeply explained, not superficial.
- Structure the presentation to reflect a clear conceptual breakdown, including:
-- Key principles and their relationships
-- Edge cases or common misunderstandings (where relevant)
-- Gradual progression or scaffolding to support layered understanding
- Use metaphor, visualization, sound cues, and interaction to reinforce mental models.

2. Technical Constraints
- You must generate a complete, standalone HTML file that can run directly in a browser or iframe.
- The HTML file must include:
  * A complete <!DOCTYPE html> declaration
  * A <head> section with:
    - <meta charset="UTF-8">
    - <meta name="viewport" content="width=device-width, initial-scale=1.0">
    - <title> tag with the project title
    - All external CSS and JS libraries loaded via <link> and <script> tags
    - Internal <style> tags for CSS
  * A <body> section with:
    - All HTML content
    - Internal <script> tags for JavaScript
  - Use Vue 3.5.20 with <script setup> syntax with ref, reactive, computed, onMounted, and nextTick via production CDN.
  - Every reactive variable must be defined before use. No undefined references.
  - Multi-stage interfaces must use v-if. Do NOT use v-show, opacity, or visibility to hide elements.
  - Only one section/page can exist in the DOM at any time. Remove others completely.
  -All DOM-dependent logic (Canvas, Three.js, Web Speech, audio) must run only inside onMounted + nextTick.
  - All v-for must include a stable key.
  - Hidden elements must use display:none. Avoid flex issues and overlapping containers.
  - Check for undefined variables, wrong bindings, invalid API calls, or version mismatches before generating output.

- You may autonomously choose one or more additional libraries from the following list if they improve the pedagogical effect:
Vue ecosystem: Vue, VueRouter, Vuex
Sound: Tone.js, Howler.js
Animation: Anime.js, GSAP.js
3D: Three.js, Babylon.js, OrbitControls, FontLoader, TextGeometry, GLTFLoader, three-mesh-ui
Charts: Chart.js, ECharts, D3.js
Tools: Lodash, Moment.js, Day.js
Forms: VeeValidate, VeeValidate Rules, VeeValidate i18n
Games: Phaser.js, Matter.js, P5.js
Graphics: Fabric.js, Rough.js, Konva.js
Physics/AI/Noise: cannon-es, Yuka, noisejs
Math: KaTeX.min.js, KaTeX.min.css, auto-render
UI: Bootstrap, Tailwindcss, Fontawesome
- Use Web Speech API when appropriate to enhance comprehension through voice narration or speech recognition.
- All external dependencies must be loaded via production-ready CDN (e.g., unpkg, cdnjs, jsdelivr) directly in the HTML file.
- All Vue variables, methods, and computed properties used in the HTML template must be explicitly defined within the Vue app setup.
- The HTML file must be completely self-contained and runnable.

3. SVG Generation & Thumbnail Requirements
- You must output a separate "svg" field in the final JSON.
- The SVG canvas size MUST be exactly 640 x 360.
  - width="640", height="360", viewBox="0 0 640 360"
- The SVG is used as a thumbnail / preview representation.
- If the content includes motion, process, or animation concepts:
  - The SVG MAY include lightweight SVG-native animations
    (e.g. <animate>, <animateTransform>, <animateMotion>).
  - Do NOT use JavaScript, CSS animations, or external references.
- The SVG must be fully self-contained:
  - No external fonts, images, scripts, or CSS.
  - No randomness; output must be deterministic.
- The SVG should visualize:
  - Core structures, key relationships, or canonical motion patterns.
- Do NOT attempt to recreate full UI, interactions, or 3D scenes.
  - For Canvas / Three.js / D3 / p5 / MediaPipe content:
    use an abstract diagram or symbolic animated snapshot only.

4. UX/UI Requirements
- Ensure the UI is responsive, touch-friendly, and optimized for both desktop and mobile.
- Use animations, transitions, and interactive visual metaphors to aid engagement and comprehension.
- Use sound and visual feedback where pedagogically helpful for user interactions (e.g., success, fail, progress, guidance).
- The layout should be minimal, accessible, and focused on content.

5. Output Language Constraint
- Language_code is: {{fallback_language}}.
- The language_code must be included as a field in the final JSON output and must be a valid BCP 47 code string (e.g., "zh-CN", "en-US", "de-CH").
- All text values in the JSON (including title, description, UI strings, tags and comments) must match the language indicated by language_code.

6. Output Format
Return the result as a single, valid JSON object. Strictly adhere to the specified structure below, with no leading or trailing text. The entire output must be parseable as a single JSON object. Any deviation, such as a missing comma, unclosed quote, or bracket, is a critical error.

{
  "title": "Title of the project",
  "description": "What this project teaches and how to interact with it",
  "full_html": "<!DOCTYPE html><html><head>...complete HTML file with all CSS and JS embedded...</head><body>...content...</body></html>",
  "svg": "<svg ...>...</svg>",
  "tags": [
    "3-7 high-quality tags that reflect subject, domain, subdomain, grade. No technical tags such as Vue, React, etc."
  ],
  "content_type": "vue",
  "language_code": "MUST match the language_code input parameter exactly as per Constraint 4"
}

IMPORTANT: The "full_html" field must contain a complete, standalone HTML file that includes:
- DOCTYPE declaration
- Complete <html>, <head>, and <body> structure
- All external libraries loaded in <head> or before closing </body>
- All CSS in <style> tags within <head>
- All JavaScript in <script> tags (Vue app initialization, etc.)
- The HTML must be valid and runnable directly in a browser

7. Only return the final JSON. Do not include explanations, instructions, or additional output beyond the required format.`;

// 学习阶段的用户提示词映射
const LEARNING_STAGE_PROMPTS = {
  understanding: `Create an interactive project that visually and audibly explains the concept of {{knowledge_point}}.
Ensure users can explore the concept in steps, with each stage accompanied by sound or animation cues.
Encourage discovery by letting users click, hover, or reveal hidden patterns and connections that show how "{{knowledge_point}}" links to broader ideas.
Each interaction should feel meaningful — revealing not just information, but relationships and insights that deepen comprehension.
End with a moment of reflection or synthesis, helping learners see the “big picture” of how "{{knowledge_point}}" fits within a wider knowledge network.`,

  application: `Build an interactive simulation that lets users apply "{{knowledge_point}}" in a real-world or scenario-based context.
Use sliders, drag-and-drop, or live input fields to manipulate variables.
Provide dynamic visual feedback and context-appropriate sound effects for user actions.`,

  assessment: `Design an interactive challenge to test the user's grasp of "{{knowledge_point}}".
Include multiple-choice, input-based, or drag-to-match interactions.
Use audio cues for right/wrong feedback and visual progress indicators like score or level bars.`,

  expansion: `Present "{{knowledge_point}}" in a way that connects it to related or advanced topics.
Let users toggle between views, click into deeper explanations, or reveal hidden patterns or links.
Use smooth transitions, layered visuals, and curiosity-triggering sound effects to guide exploration.`,

  gamify: `Turn "{{knowledge_point}}" into a mini-game with educational purpose.
Design challenges that involve collecting, matching, avoiding, or timing.
Incorporate scoring, win/lose states, and expressive sound effects.
The learning goal should stay clear and integrated into gameplay.`
};

// 学习阶段的中文名称映射
const LEARNING_STAGE_NAMES = {
  understanding: '理解',
  application: '应用',
  assessment: '测评',
  expansion: '拓展',
  gamify: '游戏化'
};

// 生成教育交互内容
const generateEducationalContent = async (knowledgePoint, learningStage, description = '', languageCode = '', userId = null, actionType = 'generate', provider = null, requestId = null, isAsyncMode = false) => {
  let logId = null;
  let logParams = {};
  try {
    // 构建完整的提示词
    const userPrompt = safeReplace(LEARNING_STAGE_PROMPTS[learningStage], '{{knowledge_point}}', knowledgePoint);
    let systemPromptWithKnowledge = safeReplace(SYSTEM_PROMPT, '{{knowledge_point}}', knowledgePoint);
    if (languageCode) {
      systemPromptWithKnowledge = safeReplace(systemPromptWithKnowledge, '{{fallback_language}}', languageCode);
    } else {
      systemPromptWithKnowledge = safeReplace(systemPromptWithKnowledge, '{{fallback_language}}', 'en-US');
    }
    
    const messages = [
      { role: 'system', content: systemPromptWithKnowledge },
      { role: 'user', content: userPrompt }
    ];

    // 使用AI提供商工厂发送请求
    const result = await aiProviderFactory.createChatCompletion({
      provider: provider || 'qenda', // 默认使用 QENDA 提供商
      messages: messages,
      max_tokens: 24000,
      temperature: 0.6
    });
    
    const aiResponse = result.content;
    // tokens字段名修正，全部用prompt_tokens/completion_tokens/total_tokens
    const usage = result.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    if (!aiResponse) {
      if (isAsyncMode && requestId) {
        // 异步模式：更新现有记录
        await updateExistingLog(requestId, {
          model_name: result.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
          generation_params: {
            knowledge_point: knowledgePoint,
            learning_stage: learningStage,
            description: description,
            language_code: languageCode,
            provider: provider
          },
          response_metadata: { provider: result.provider, model: result.model },
          error_message: 'AI返回内容为空',
          is_json_valid: false,
          is_render_success: false
        });
      } else {
        // 同步模式：创建新记录
        await logAIUsageWithDefaults({
          user_id: userId,
          model_name: result.model,
          user_query: knowledgePoint,
          action_type: actionType,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
          response_metadata: { provider: result.provider, model: result.model },
          error_message: 'AI返回内容为空',
          request_id: requestId
        });
      }
      throw new Error('AI返回内容为空');
    }
    // 尝试从AI响应中提取JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedDataRaw = JSON.parse(jsonMatch[0]);
        const parsedData = {
          ...parsedDataRaw,
          language_code: parsedDataRaw.language_code || languageCode || 'zh-CN'
        };
        
        // 验证 full_html 是否存在
        if (!parsedData.full_html || typeof parsedData.full_html !== 'string' || parsedData.full_html.trim().length === 0) {
          throw new Error('AI返回的 full_html 字段为空或无效');
        }

        parsedData.full_html = replaceLibrariesInHtml(parsedData.full_html);
        
        // 日志：成功解析JSON并验证 full_html
        // 注意：只有在 full_html 验证通过后才记录成功日志
        if (isAsyncMode && requestId) {
          // 异步模式：更新现有记录
          await updateExistingLog(requestId, {
            model_name: result.model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
            generation_params: {
              knowledge_point: knowledgePoint,
              learning_stage: learningStage,
              description: description,
              language_code: languageCode,
              provider: provider
            },
            response_metadata: { provider: result.provider, model: result.model, raw: result.response },
            created_at: new Date(result.created ? result.created * 1000 : Date.now()),
            is_json_valid: true,
            is_render_success: true,
            error_message: null
          });
        } else {
          // 同步模式：创建新记录（只有在 full_html 验证通过后才记录）
          // 注意：同步模式下，content_id 会在调用方创建 content 后更新
          // 生成 request_id（如果为 null）
          const { v4: uuidv4 } = require('uuid');
          const finalRequestId = requestId || uuidv4();
          
          await logAIUsageWithDefaults({
            user_id: userId,
            model_name: result.model,
            user_query: knowledgePoint,
            action_type: actionType,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
            response_metadata: { provider: result.provider, model: result.model, raw: result.response },
            created_at: new Date(result.created ? result.created * 1000 : Date.now()),
            is_json_valid: true,
            is_render_success: true,
            error_message: null,
            request_id: finalRequestId,
            content_id: null, // 将在调用方创建 content 后更新
            status: 'done' // 同步模式下，成功生成时状态为 done
          });
        }
    return {
      success: true,
          data: parsedData
        };
      } catch (parseError) {
        if (isAsyncMode && requestId) {
          // 异步模式：更新现有记录
          await updateExistingLog(requestId, {
            model_name: result.model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
            generation_params: {
              knowledge_point: knowledgePoint,
              learning_stage: learningStage,
              description: description,
              language_code: languageCode,
              provider: provider
            },
            response_metadata: { provider: result.provider, model: result.model, raw: result.response },
            created_at: new Date(result.created ? result.created * 1000 : Date.now()),
            is_json_valid: false,
            is_render_success: false,
            error_message: `JSON解析失败: ${parseError.message}`
          });
        } else {
          // 同步模式：创建新记录
          await logAIUsageWithDefaults({
            user_id: userId,
            model_name: result.model,
            user_query: knowledgePoint,
            action_type: actionType,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
            response_metadata: { provider: result.provider, model: result.model, raw: result.response },
            created_at: new Date(result.created ? result.created * 1000 : Date.now()),
            is_json_valid: false,
            error_message: `JSON解析失败: ${parseError.message}`,
            request_id: requestId
          });
        }
        return {
          success: false,
          error: 'JSON解析失败',
          details: `解析错误: ${parseError.message}，AI返回内容长度: ${aiResponse.length}`
        };
      }
    } else {
      if (isAsyncMode && requestId) {
        // 异步模式：更新现有记录
        await updateExistingLog(requestId, {
          model_name: result.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
          generation_params: {
            knowledge_point: knowledgePoint,
            learning_stage: learningStage,
            description: description,
            language_code: languageCode,
            provider: provider
          },
          response_metadata: { provider: result.provider, model: result.model },
          created_at: new Date(result.created ? result.created * 1000 : Date.now()),
          is_json_valid: false,
          is_render_success: false,
          error_message: '未找到JSON格式'
        });
      } else {
        // 同步模式：创建新记录
        await logAIUsageWithDefaults({
          user_id: userId,
          model_name: result.model,
          user_query: knowledgePoint,
          action_type: actionType,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: { messages, max_tokens: 24000, temperature: 0.6 },
          response_metadata: { provider: result.provider, model: result.model },
          created_at: new Date(result.created ? result.created * 1000 : Date.now()),
          is_json_valid: false,
          error_message: '未找到JSON格式',
          request_id: requestId
        });
      }
      return {
        success: false,
        error: '未找到JSON格式',
        details: `AI返回的内容中没有找到有效的JSON结构，内容长度: ${aiResponse.length}`
      };
    }
  } catch (error) {
    // 捕获主流程异常
    // 判断错误类型：如果是 full_html 验证失败，说明 JSON 解析成功了
    const isJsonValid = error.message && (error.message.includes('full_html') || error.message.includes('full_html 字段')) ? true : false;
    
    if (isAsyncMode && requestId) {
      // 异步模式：更新现有记录
      await updateExistingLog(requestId, {
        error_message: error.message || 'AI生成失败',
        generation_params: {
          knowledge_point: knowledgePoint,
          learning_stage: learningStage,
          description: description,
          language_code: languageCode,
          provider: provider
        },
        is_json_valid: isJsonValid,
        is_render_success: false
      });
    } else {
      // 同步模式：创建新记录
      // 生成 request_id（如果为 null）
      const { v4: uuidv4 } = require('uuid');
      const finalRequestId = requestId || uuidv4();
      
      await logAIUsageWithDefaults({
        user_id: userId,
        model_name: result?.model || null,
        user_query: knowledgePoint,
        action_type: actionType,
        input_tokens: result?.usage?.prompt_tokens || result?.usage?.input_tokens || 0,
        output_tokens: result?.usage?.completion_tokens || result?.usage?.output_tokens || 0,
        total_tokens: result?.usage?.total_tokens || 0,
        request_payload: result ? { messages, max_tokens: 24000, temperature: 0.6 } : null,
        response_metadata: result ? { provider: result.provider, model: result.model, raw: result.response } : null,
        created_at: result?.created ? new Date(result.created * 1000) : new Date(),
        error_message: error.message || 'AI生成失败',
        is_json_valid: isJsonValid,
        is_render_success: false,
        request_id: finalRequestId,
        content_id: null, // 同步模式下，如果失败，content 还没有创建
        status: 'failed' // 同步模式下，失败时状态为 failed
      });
    }
    return {
      success: false,
      error: error.message || 'AI生成失败'
    };
  }
};

// 简化的AI生成测试
const generateSimpleContent = async (knowledgePoint, learningStage) => {
  try {
    if (!ARK_API_KEY || ARK_API_KEY === 'your_ark_api_key_here') {
      throw new Error('ARK_API_KEY未配置或使用默认值，请在.env文件中配置真实的API密钥');
    }

    // 简化的提示词
    const simplePrompt = safeReplace(`请为知识点"{{knowledge_point}}"创建一个简单的Vue 3交互式教育项目。学习阶段：{{learning_stage}}。

请返回一个简单的JSON格式：
{
  "title": "项目标题",
  "description": "项目描述",
  "full_html": "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>项目标题</title><script src='https://unpkg.com/vue@3/dist/vue.global.prod.js'></script><style>body { font-family: sans-serif; } #app { padding: 20px; }</style></head><body><div id='app'>{{ message }}</div><script>const { createApp } = Vue; createApp({ data() { return { message: 'Hello World!' } } }).mount('#app');</script></body></html>",
  "tags": ["测试", "Vue3"],
  "content_type": "vue",
  "language_code": "zh-CN"
}`, '{{knowledge_point}}', knowledgePoint);

    const finalPrompt = safeReplace(simplePrompt, '{{learning_stage}}', learningStage);

    const response = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'user', content: finalPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API错误:', errorText);
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('AI API返回格式错误');
    }

    const aiResponse = data.choices[0].message.content;

    // 解析AI返回的JSON
    let parsedData;
    let jsonMatch = null; // 声明在外部作用域
    try {
      // 尝试多种JSON匹配模式
      jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        // 尝试找到包含JSON的代码块
        const codeBlockMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonMatch = [codeBlockMatch[1]];
        }
      }
      
      if (!jsonMatch) {
        // 尝试找到最后一个完整的JSON对象
        const matches = aiResponse.match(/\{[\s\S]*?\}/g);
        if (matches && matches.length > 0) {
          jsonMatch = [matches[matches.length - 1]];
        }
      }
      
      if (!jsonMatch) {
        // 最后尝试：查找任何可能的JSON结构
        const possibleJson = aiResponse.match(/\{[^{}]*"[^{}]*"[^{}]*\}/);
        if (possibleJson) {
          jsonMatch = [possibleJson[0]];
        }
      }
      
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
        
        // 验证 full_html 是否存在
        if (!parsedData.full_html || typeof parsedData.full_html !== 'string' || parsedData.full_html.trim().length === 0) {
          throw new Error('AI返回的 full_html 字段为空或无效');
        }
        
        parsedData.full_html = replaceLibrariesInHtml(parsedData.full_html);
        
        return {
          success: true,
          data: parsedData,
          learningStage: LEARNING_STAGE_NAMES[learningStage]
        };
      } else {
        console.error('未找到JSON格式，完整响应:', aiResponse);
        throw new Error('无法解析AI返回的JSON，请检查AI返回的格式');
      }
    } catch (parseError) {
      console.error('AI返回内容解析失败:', parseError);
      console.error('AI原始响应内容:', aiResponse);
      throw new Error(`AI返回内容格式错误: ${parseError.message}`);
    }

  } catch (error) {
    console.error('简化AI生成错误:', error);
    return {
      success: false,
      error: error.message || '简化AI生成失败'
    };
  }
};

// AI修复接口（已接入多提供商）
const fixEducationalContent = async ({ full_html, note, content_type, language_code, title, description, user_id = null, provider = null, requestId = null }) => {
  let logParams = {};
  try {
    // 构建修复prompt
    const SYSTEM_PROMPT = `You are an expert Vue 3 frontend developer and educational UI engineer.
    Your task is to fix and improve a complete standalone HTML file for an interactive Vue 3 educational project.
    Only modify the "full_html" field in the provided JSON:
    - full_html: A complete, standalone HTML file that includes DOCTYPE, <html>, <head>, and <body> tags
    - All CSS must be in <style> tags within <head>
    - All JavaScript must be in <script> tags (before closing </body>)
    - All external libraries must be loaded via CDN in <head> or before </body>
    - fixed: A short non-technical summary of what was changed or fixed (1-2 sentences)
    
    Constraints:
    - Use Vue 3.5.20 with <script setup> style via production CDN
    - The HTML file must be completely self-contained and runnable
    - Ensure mobile and desktop compatibility
    - Only output valid JSON with the following format: 
    {
      "full_html": "<!DOCTYPE html><html>...complete HTML file...</html>",
      "fixed": "a short non-technical summary of what was changed or fixed (1-2 sentences)"
    }
    If you receive error logs, fix the specific issue.
    If you receive a user modification note, apply it as a functional update or enhancement.
    Do not change project structure or title. Focus only on fixing code or updating interactivity/behavior.`;
      
    const USER_PROMPT = safeReplace(`The current Vue 3 project has the following issue or user request:\n{{note}}\n\nCurrent full_html:\n{{full_html}}`, '{{note}}', note);

    const finalUserPrompt = safeReplace(USER_PROMPT, '{{full_html}}', full_html || '');

    // 使用AI提供商工厂发送请求
    const result = await aiProviderFactory.createChatCompletion({
      provider: provider || 'qenda', // 默认使用 QENDA 提供商
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: finalUserPrompt }
      ],
      max_tokens: 24000,
      temperature: 0.6
    });

    const aiResponse = result.content;
    const usage = result.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    if (!aiResponse) {
      await logAIUsageWithDefaults({
        user_id,
        model_name: result.model,
        user_query: note,
        action_type: 'fix',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        request_payload: { full_html, note, content_type, language_code, title, description },
        response_metadata: { provider: result.provider, model: result.model, raw: result.response },
        error_message: 'AI返回内容为空',
        request_id: requestId
      });
      return { success: false, error: 'AI返回内容为空' };
    }
    let parsed;
    let jsonMatch = null;
    try {
      jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const codeBlockMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonMatch = [codeBlockMatch[1]];
        }
      }
      if (!jsonMatch) {
        const matches = aiResponse.match(/\{[\s\S]*?\}/g);
        if (matches && matches.length > 0) {
          jsonMatch = [matches[matches.length - 1]];
        }
      }
      if (!jsonMatch) {
        const possibleJson = aiResponse.match(/\{[^{}]*"[^{}]*"[^{}]*\}/);
        if (possibleJson) {
          jsonMatch = [possibleJson[0]];
        }
      }
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
        
        // 验证 full_html 是否存在
        if (!parsed.full_html || typeof parsed.full_html !== 'string' || parsed.full_html.trim().length === 0) {
          throw new Error('AI返回的 full_html 字段为空或无效');
        }
        
        parsed.full_html = replaceLibrariesInHtml(parsed.full_html);
        
        await logAIUsageWithDefaults({
          user_id,
          model_name: result.model,
          user_query: note,
          action_type: 'fix',
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          total_tokens: totalTokens,
          request_payload: { full_html, note, content_type, language_code, title, description },
          response_metadata: { provider: result.provider, model: result.model, raw: result.response },
          created_at: new Date(result.created ? result.created * 1000 : Date.now()),
          is_json_valid: true,
          error_message: null,
          request_id: requestId
        });
      } else {
        console.error('无法找到修复JSON结构，原始内容:', aiResponse);
        throw new Error('AI返回内容无法解析，请检查AI返回的格式');
      }
    } catch (e) {
      await logAIUsage({
        user_id,
        model_name: result.model,
        user_query: note,
        action_type: 'fix',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        request_payload: { full_html, note, content_type, language_code, title, description },
        response_metadata: { provider: result.provider, model: result.model, raw: result.response },
        created_at: new Date(result.created ? result.created * 1000 : Date.now()),
        is_json_valid: false,
        is_render_success: false,
        error_message: `JSON解析失败: ${e.message}`
      });
      console.error('修复JSON解析错误:', e);
      console.error('尝试解析的内容:', jsonMatch ? jsonMatch[0] : '未找到JSON');
      return { success: false, error: `AI返回内容格式错误: ${e.message}` };
    }
    return { success: true, data: parsed };
  } catch (e) {
    await logAIUsageWithDefaults({
      user_id,
      user_query: note,
      action_type: 'fix',
      error_message: e.message || 'AI修复失败',
      request_id: requestId
    });
    return { success: false, error: e.message };
  }
};

// 获取支持的学习阶段
const getSupportedLearningStages = () => {
  return Object.keys(LEARNING_STAGE_PROMPTS).map(key => ({
    value: key,
    label: LEARNING_STAGE_NAMES[key]
  }));
};

// 获取学习阶段描述
const getLearningStageDescription = (stage) => {
  const descriptions = {
    understanding: '帮助用户快速掌握知识的核心原理和逻辑结构，通过可视化和可操作性增强理解。',
    application: '引导用户在模拟或真实场景中主动使用知识点，建立"会用"的能力。',
    assessment: '检测用户对知识点的掌握情况，提供即时反馈和评分。',
    expansion: '将知识引申到更广阔的视角，如跨学科应用、现实案例或进阶原理。',
    gamify: '增强学习动机，通过游戏机制让知识获得更高参与度和记忆度。'
  };
  return descriptions[stage] || '';
};

// 验证学习阶段
const validateLearningStage = (stage) => {
  return Object.keys(LEARNING_STAGE_PROMPTS).includes(stage);
};

// 测试安全替换函数（开发环境使用）
const testSafeReplace = () => {
  const testCases = [
    {
      template: '知识点：{{knowledge_point}}',
      placeholder: '{{knowledge_point}}',
      value: 'JavaScript中的"引号"和\'单引号\'',
      expected: '知识点：JavaScript中的\\"引号\\"和\\\'单引号\\\''
    },
    {
      template: 'HTML: {{knowledge_point}}',
      placeholder: '{{knowledge_point}}',
      value: '<script>alert("xss")</script>',
      expected: 'HTML: <script>alert(\\"xss\\")</script>'
    },
    {
      template: 'SQL: {{knowledge_point}}',
      placeholder: '{{knowledge_point}}',
      value: '\'; DROP TABLE users; --',
      expected: 'SQL: \\\'; DROP TABLE users; --'
    }
  ];

  console.log('测试安全替换函数:');
  testCases.forEach((testCase, index) => {
    const result = safeReplace(testCase.template, testCase.placeholder, testCase.value);
    const passed = result === testCase.expected;
    console.log(`测试 ${index + 1}: ${passed ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  输入: ${testCase.value}`);
    console.log(`  输出: ${result}`);
    console.log(`  期望: ${testCase.expected}`);
    console.log('');
  });
};

// replaceWithSupportedLibraries 函数已删除（不再需要，因为已切换到 full_html 模式）

// 记录前端渲染结果API
router.post('/api/ai/log_render_status', async (req, res) => {
  const { log_id, is_render_success, error_message } = req.body;
  if (!log_id) return res.status(400).json({ error: 'log_id required' });
  try {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .update({
        is_render_success: !!is_render_success,
        error_message: error_message || null
      })
      .eq('id', log_id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 获取可用的AI提供商列表（注意：该router会挂载在 /api/ai 下，这里使用相对路径）
router.get('/providers', async (req, res) => {
  try {
    const providers = aiProviderFactory.getAvailableProviders();
    return res.json({ success: true, providers });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 测试AI提供商连接
router.post('/test-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    const result = await aiProviderFactory.testProvider(provider);
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 获取当前默认提供商
router.get('/default-provider', async (req, res) => {
  try {
    const defaultProvider = aiProviderFactory.defaultProvider;
    const provider = aiProviderFactory.getProvider();
    return res.json({ 
      success: true, 
      defaultProvider,
      provider: {
        key: defaultProvider,
        name: provider.name,
        model: provider.model
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = {
  generateEducationalContent,
  getSupportedLearningStages,
  getLearningStageDescription,
  validateLearningStage,
  LEARNING_STAGE_NAMES,
  fixEducationalContent,
  safeReplace,  // 导出安全替换函数供测试使用
  testSafeReplace,  // 导出测试函数
  aiProviderFactory, // 导出AI提供商工厂
  router // 导出路由
}; 