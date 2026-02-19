const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { logAIUsage } = require('./database');
const express = require('express');
const router = express.Router();
const { supabase } = require('./database');
const AIProviderFactory = require('./aiProviderFactory');
const logger = require('../utils/logger');
const { uploadToFreeimageHost } = require('./freeimage_upload_service');

/** 生成内容时：按 user_id 读取 user_init_context（仅登录用户会调生成接口）。 */
async function getInitContextForUser(userId) {
  if (!userId) return { role: null, context: null };
  const { data: row } = await supabase.from('user_init_context').select('context').eq('user_id', userId).maybeSingle();
  const context = row?.context || null;
  const role = context?.role || null;
  return { role, context };
}

/** 将 init_context + role 转成 JSON 可嵌入的「目标受众」对象，供 system prompt 的 target_audience 字段使用。使用 audience_role 避免与 identity（AI 身份）混淆。 */
function buildTargetAudience(ctx, role) {
  if (!ctx || typeof ctx !== 'object') return null;
  const roleStr = role || ctx.role;
  if (!roleStr) return null;
  const currentYear = new Date().getFullYear();
  const age = ctx.age ?? (ctx.birthYear != null ? currentYear - ctx.birthYear : null);
  const out = { audience_role: roleStr };
  if (roleStr === 'student' && age != null) {
    out.learner_age = age;
  } else if (roleStr === 'parent' && age != null) {
    out.child_age = age;
  } else if (roleStr === 'teacher' && Array.isArray(ctx.teachingAgeRanges) && ctx.teachingAgeRanges.length) {
    out.teaching_age_ranges = ctx.teachingAgeRanges;
  }
  return Object.keys(out).length > 1 ? out : (out.audience_role ? out : null);
}

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

// 更新现有的AI使用日志记录（带重试机制）
const updateExistingLog = async (requestId, updateData, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
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
        // 如果是网络错误且还有重试次数，则重试
        const isNetworkError = error.message && (
          error.message.includes('fetch failed') ||
          error.message.includes('SocketError') ||
          error.message.includes('UND_ERR_SOCKET') ||
          error.message.includes('other side closed')
        );
        
        if (isNetworkError && attempt < retries) {
          // 等待后重试（指数退避）
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 非网络错误或重试次数用完，记录错误但不抛出
        logger.error('更新AI使用日志失败:', {
          requestId,
          attempt,
          error: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          }
        });
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      // 捕获异常错误
      const isNetworkError = error.message && (
        error.message.includes('fetch failed') ||
        error.message.includes('SocketError') ||
        error.message.includes('UND_ERR_SOCKET') ||
        error.message.includes('other side closed')
      );
      
      if (isNetworkError && attempt < retries) {
        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 重试次数用完或非网络错误，记录错误
      logger.error('更新AI使用日志失败:', {
        requestId,
        attempt,
        error: {
          message: error.message,
          details: typeof error.details === 'string' ? error.details : (error.stack || JSON.stringify(error.details)),
          hint: error.hint,
          code: error.code
        }
      });
      return { success: false, error };
    }
  }
  
  // 所有重试都失败
  return { success: false, error: { message: '所有重试都失败' } };
};

// 修复 AI 返回 JSON 中的非法转义（LaTeX 反斜杠等）。JSON 仅允许 \" \\ \/ \b \f \n \r \t \uXXXX
const repairJsonEscapes = (str) => str.replace(/\\(.)/g, (m, c) => {
  if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(c)) return m;
  if (c === 'u') return m;
  return '\\\\' + c;
});

const tryParseAiJson = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (firstError) {
    const repaired = repairJsonEscapes(jsonString);
    try {
      const parsed = JSON.parse(repaired);
      logger.info('[aiService] JSON 经转义修复后解析成功');
      return parsed;
    } catch (secondError) {
      throw firstError; // 修复后仍失败，抛出原始错误
    }
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

// 从 URL 中提取库名和文件名
const extractLibraryInfo = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // 特殊处理：tailwindcss.com 等没有文件名的 CDN
  if (url.includes('cdn.tailwindcss.com')) {
    return {
      name: 'tailwindcss',
      version: null,
      file: 'tailwindcss.js' // 使用通用文件名
    };
  }
  
  // 提取文件名（URL 最后一段，去掉查询参数）
  const fileName = url.split('/').pop()?.split('?')[0];
  
  // 如果没有文件名或文件名不是 .js/.css，尝试从 URL 路径推断
  if (!fileName || (!fileName.endsWith('.js') && !fileName.endsWith('.css'))) {
    // 尝试从 URL 路径中提取文件名（例如 /dist/katex.min.js）
    const pathMatch = url.match(/\/([^/]+\.(js|css))(?:\?|$)/i);
    if (pathMatch) {
      const inferredFileName = pathMatch[1];
      return {
        name: null,
        version: null,
        file: inferredFileName
      };
    }
    return null;
  }
  
  // 尝试从 URL 中提取库名和版本
  // 模式1: package@version/path/file.js 或 @scope/package@version/path/file.js
  const versionMatch = url.match(/(?:@([^/]+)\/)?([^/@]+)@([^/]+)/);
  if (versionMatch) {
    const scope = versionMatch[1];
    const packageName = versionMatch[2];
    const version = versionMatch[3];
    const fullName = scope ? `${scope}/${packageName}` : packageName;
    return {
      name: fullName,
      version: version,
      file: fileName
    };
  }
  
  // 模式2: 从文件名推断库名（去掉 .min.js, .js, .min.css, .css 等后缀）
  // 例如: vue.global.prod.js -> vue, katex.min.js -> katex, auto-render.min.js -> auto-render
  const nameFromFile = fileName
    .replace(/\.(min\.)?(js|css)$/i, '')
    .replace(/\.(global|prod|dev|bundle)/i, '')
    .split('.')[0]; // 取第一部分（例如 vue.global.prod.js -> vue）
  
  return {
    name: nameFromFile || null,
    version: null,
    file: fileName
  };
};

// 生成阿里云 OSS fallback URL
const generateFallbackUrl = (libraryInfo, type) => {
  if (!libraryInfo || !libraryInfo.file) return null;
  
  const baseUrl = 'https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib';
  return `${baseUrl}/${libraryInfo.file}`;
};

const findReplacementUrl = (url, type) => {
  if (!url || typeof url !== 'string') return null;

  const matchFromEntries = (entries) => {
    if (!entries || !entries.length) return null;
    
    // 优先匹配最精确的 pattern（最长的 pattern 优先）
    const matches = [];
    for (const entry of entries) {
      if (entry.type !== type) continue;
      if (!entry.patterns || !entry.patterns.length) continue;
      
      // 检查每个 pattern，找到最精确的匹配
      for (const pattern of entry.patterns) {
        if (pattern && url.includes(pattern)) {
          matches.push({
            entry,
            pattern,
            patternLength: pattern.length,
            url: entry.url
          });
        }
      }
    }
    
    if (matches.length === 0) return null;
    
    // 按 pattern 长度降序排序，优先选择最精确的匹配
    matches.sort((a, b) => b.patternLength - a.patternLength);
    
    // 返回最精确匹配的 URL（如果与原始 URL 不同）
    const bestMatch = matches[0];
    if (bestMatch.url && bestMatch.url !== url) {
      return bestMatch.url;
    }
    
    return null;
  };

  return matchFromEntries(getSupportedLibraryEntries());
};

const replaceLibrariesInHtml = (html) => {
  if (typeof html !== 'string' || !html.trim()) return html;

  let updatedHtml = html;
  
  // 先收集所有 script 标签，用于检测重复和纠正
  const scriptMatches = [];
  const scriptPattern = /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    scriptMatches.push({
      fullMatch: match[0],
      beforeAttrs: match[1],
      src: match[2],
      afterAttrs: match[3],
      index: match.index
    });
  }
  
  // 检测重复的 katex.min.js，并标记第二个应该替换为 auto-render.min.js
  const katexMatches = scriptMatches.filter(m => {
    const fileName = m.src.split('/').pop()?.split('?')[0];
    return fileName === 'katex.min.js' && !m.src.includes('auto-render');
  });
  
  // 如果发现两个 katex.min.js，第二个应该替换为 auto-render.min.js
  const duplicateKatexMap = new Map();
  if (katexMatches.length > 1) {
    // 从第二个开始，都应该替换为 auto-render.min.js
    for (let i = 1; i < katexMatches.length; i++) {
      duplicateKatexMap.set(katexMatches[i].src, true);
    }
    logger.warn(`[Library Replacement] 检测到 ${katexMatches.length} 个重复的 katex.min.js，将自动纠正第二个及之后的为 auto-render.min.js`);
  }

  // 替换 <script src="...">，优先使用 supported-libraries，失败回退到阿里云 OSS（通过 onerror）
  updatedHtml = updatedHtml.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (match, beforeAttrs, src, afterAttrs) => {
      // 如果已经有 onerror，跳过处理（避免重复处理）
      if (/onerror=/i.test(match)) {
        return match;
      }
      
      // 1. 尝试从 supported-libraries.json 中找到匹配的 URL
      let primary = findReplacementUrl(src, 'js');
      
      // 2. 特殊处理：如果检测到重复的 katex.min.js，第二个及之后的应该替换为 auto-render.min.js
      if (duplicateKatexMap.has(src)) {
        const autoRenderUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js';
        primary = autoRenderUrl;
        logger.info(`[Library Replacement] 自动纠正重复的 katex.min.js 为 auto-render.min.js: ${src}`);
      }
      
      // 3. 提取库信息用于生成 fallback URL
      // 如果 primary 存在，使用 primary 的 URL 来提取文件名（更准确）
      const sourceUrlForExtraction = primary || src;
      const libraryInfo = extractLibraryInfo(sourceUrlForExtraction);
      
      // 4. 生成阿里云 OSS fallback URL（基于实际文件名）
      const fallback = libraryInfo ? generateFallbackUrl(libraryInfo, 'js') : null;
      
      // 如果 primary 存在，使用 primary + fallback
      if (primary) {
        if (fallback) {
          return `<script${beforeAttrs || ''} src="${primary}" onerror="this.onerror=null; this.src='${fallback}'"${afterAttrs || ''}></script>`;
        }
        return `<script${beforeAttrs || ''} src="${primary}"${afterAttrs || ''}></script>`;
      }
      
      // 如果 primary 不存在但能生成 fallback，使用原始 URL + fallback
      if (fallback) {
        return `<script${beforeAttrs || ''} src="${src}" onerror="this.onerror=null; this.src='${fallback}'"${afterAttrs || ''}></script>`;
      }

      // 未匹配到任何替换，保持原样
      return match;
    }
  );

  // 替换 <link href="...">
  updatedHtml = updatedHtml.replace(
    /<link\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (match, beforeAttrs, href, afterAttrs) => {
      // 如果已经有 onerror，跳过处理（CSS link 标签不支持 onerror，但为了统一处理）
      if (/onerror=/i.test(match)) {
        return match;
      }
      
      const relMatch = match.match(/\brel=["']([^"']+)["']/i);
      const rel = relMatch ? relMatch[1].toLowerCase() : '';
      if (rel && rel !== 'stylesheet' && rel !== 'preload' && rel !== 'prefetch') {
        return match;
      }
      
      // 1. 尝试从 supported-libraries.json 中找到匹配的 URL
      const primary = findReplacementUrl(href, 'css');
      
      // 2. 提取库信息用于生成 fallback URL
      const libraryInfo = extractLibraryInfo(href);
      
      // 3. 生成阿里云 OSS fallback URL
      const fallback = libraryInfo ? generateFallbackUrl(libraryInfo, 'css') : null;
      
      if (primary) {
        // CSS link 标签不支持 onerror，但我们可以添加一个备用 link 标签
        // 或者直接使用 primary（因为 CSS 通常不需要 fallback）
        return `<link${beforeAttrs || ''} href="${primary}"${afterAttrs || ''}>`;
      }
      
      // 如果 primary 不存在但能生成 fallback，保持原样（CSS 不支持 onerror）
      // 或者可以考虑添加一个备用 link 标签，但为了简单，这里保持原样
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

// ========== 动态系统提示词定义 ==========
// 根据 AI_Content_Type.md 文档设计

// 1. 通用部分（所有输出类型都需要）
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
    "parsing_rule": "The entire output MUST be valid, strictly parseable JSON. All string values must use proper escaping (e.g. backslash as \\\\, quote as \\\").",
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

// 交互式内容骨架：AI 按此填空，head 中自行添加 KaTeX/Tailwind 等依赖
// uiState 约定：__eduNestUIStateProvider 返回 { stageIndex, totalStages, currentStage }，与后端/teaching_snapshot 一致
const INTERACTIVE_CODE_FRAMEWORK = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <script src="https://cdn.jsdelivr.net/npm/vue@3.5.20/dist/vue.global.prod.js"></script>
  <!-- AI adds: katex, tailwind, three, gsap, etc. as needed -->
</head>
<body class="bg-slate-50"><div id="app" class="max-w-4xl mx-auto p-6">
  <div v-for="(s, i) in stages" :key="i" v-show="step === i + 1" class="bg-white p-6 rounded-xl">
    <h2 v-if="s.title">{{ s.title }}</h2>
    <div v-if="s.content" v-html="s.content"></div>
    <button v-if="i < stages.length - 1" @click="nextStage">Next</button>
    <button v-else @click="reset">Return to Start</button>
  </div>
</div>
<script>
const { createApp, ref, nextTick } = Vue;
createApp({ setup() {
  const stages = ref([{ title: '{{STAGE_1_TITLE}}', content: '{{STAGE_1_CONTENT}}' }]);
  const step = ref(1);
  const nextStage = () => { step.value = Math.min(step.value + 1, stages.value.length); window.eduNestRuntime?.dispatchLearningEvent('stage_change', { stageIndex: step.value, totalStages: stages.value.length }); };
  const reset = () => { step.value = 1; nextTick(()=>{}); };
  if (typeof window !== 'undefined') window.__eduNestUIStateProvider = function() { return { stageIndex: step.value, totalStages: stages.value.length, currentStage: (stages.value[step.value - 1] && stages.value[step.value - 1].title) || '' }; };
  return { stages, step, nextStage, reset };
} }).mount('#app');
</script></body></html>`;

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
      "code": "Base full_html on the skeleton below. Fill placeholders only. Do not add MutationObserver, renderMathInElement(document.body), MathRenderManager, or mount('body'). For math formulas, write TeX directly in the HTML using $...$, $$...$$, or data-tex/data-katex attributes and let the host platform handle rendering; do not create empty math container divs (like <div id=\"math-1\"></div>) with separate renderMath or katex.render loops for stage changes.",
      "stages": "stages array length is content-driven: use 1–5 or more stages as appropriate (intro, steps, summary, etc.); each stage may have different structure (title, content, step list, formulas).",
      "libraries": "Three/GSAP/D3/p5/etc allowed; load via CDN; target Vue refs only.",
      "runtime_ui_state": "REQUIRED: Expose window.__eduNestUIStateProvider as a function that returns the current uiState (object). Learn page only reads uiState; keep the same shape as in the skeleton (stageIndex, totalStages, currentStage). Call window.eduNestRuntime?.dispatchLearningEvent('stage_change', { stageIndex, totalStages }) when the user advances (e.g. in nextStage)."
    },
    
    "ux_ui_requirements": {
      "responsive": "mobile first",
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
        "start_policy": "Playback and narration begin ONLY after user click. Audio autoplay without user interaction is strictly forbidden."
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
const getSystemPrompt = (knowledgePoint, languageCode, outputType = 'interactive', targetAudience = null) => {
  // 深拷贝通用部分
  const systemPrompt = JSON.parse(JSON.stringify(COMMON_SYSTEM_PROMPT));
  
  // 根据 output_type 添加特定配置
  const typeSpecific = TYPE_SPECIFIC_PROMPTS[outputType];
  if (typeSpecific) {
    // 合并所有特定配置
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

  if (targetAudience && typeof targetAudience === 'object' && Object.keys(targetAudience).length) {
    systemPrompt.target_audience = targetAudience;
  }
  
  // 替换占位符
  let promptStr = JSON.stringify(systemPrompt, null, 2);
  promptStr = safeReplace(promptStr, '{{fallback_language}}', languageCode || 'en-US');
  promptStr = safeReplace(promptStr, '{{content_type}}', outputType); // outputType 本身就是 'interactive' 或 'animated'

  if (outputType === 'interactive') {
    promptStr += '\n\n## skeleton (fill placeholders only)\n\n' + INTERACTIVE_CODE_FRAMEWORK;
  }

  return promptStr;
};

// 用户提示词模板（根据 output_type 选择）
const INTERACTIVE_USER_PROMPTS = `Create an interactive educational project that teaches "{{knowledge_point}}".

Help learners deeply understand it through interactive exploration.
Let users explore in steps, with interactions that reveal relationships and insights. Show how it connects to broader ideas and real-world applications.
End with reflection or synthesis, helping learners see the "big picture" of how it fits within a wider knowledge network and connects to related concepts.`;

const ANIMATED_USER_PROMPTS = `Create an animated visualization that explains "{{knowledge_point}}" through a complete visual narrative.

The animation should help viewers understand the full process and core idea without additional explanation.`;

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

const MAX_IMAGES = 3;

// 生成教育交互内容（支持多图，最多 MAX_IMAGES 张）
const generateEducationalContent = async (knowledgePoint, outputType = 'interactive', description = '', languageCode = '', userId = null, actionType = 'generate', provider = null, requestId = null, isAsyncMode = false, images = null) => {
  let logId = null;
  let logParams = {};
  // 兼容单图入参：image 或 images[单元素]
  const imagesList = Array.isArray(images) && images.length > 0
    ? images.slice(0, MAX_IMAGES).filter((img) => img && img.mime_type && img.data)
    : (images && images.mime_type && images.data ? [images] : []);

  try {
    // 验证 outputType
    if (!OUTPUT_TYPE_CONFIGS[outputType]) {
      outputType = 'interactive'; // 默认使用 interactive
      logger.warn(`[generateEducationalContent] 无效的 outputType，使用默认值 interactive`);
    }
    
    // 根据 outputType 选择对应的用户提示词
    const config = OUTPUT_TYPE_CONFIGS[outputType] || OUTPUT_TYPE_CONFIGS.interactive;
    const userPromptTemplate = config.userPrompt;
    const userPrompt = safeReplace(userPromptTemplate, '{{knowledge_point}}', knowledgePoint);
    
    // 动态生成系统提示词（含 target_audience 时融入 JSON）
    let targetAudience = null;
    if (userId) {
      const { role: userRole, context: initContext } = await getInitContextForUser(userId);
      targetAudience = buildTargetAudience(initContext, userRole);
    }
    const systemPromptWithKnowledge = getSystemPrompt(knowledgePoint, languageCode || 'en-US', outputType, targetAudience);

    const userMessage = {
      role: 'user',
      content: userPrompt
    };

    // 多图：统一通过 freeimage 上传并保存链接（同步模式下在此上传；异步模式下由队列在添加任务时已上传）
    const imageUrlResults = [];
    if (imagesList.length > 0) {
      if (!isAsyncMode) {
        for (let i = 0; i < imagesList.length; i++) {
          const img = imagesList[i];
          try {
            const ext = (img.mime_type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const filename = `ai-gen-${Date.now()}-${i}.${ext}`;
            const uploadResult = await uploadToFreeimageHost(img.data, filename, img.mime_type);
            imageUrlResults.push({
              url: uploadResult.url,
              displayUrl: uploadResult.displayUrl || uploadResult.url,
              mime_type: img.mime_type
            });
            logger.info(`[AI Service] 图片 ${i + 1}/${imagesList.length} 已上传至 freeimage`);
          } catch (uploadErr) {
            logger.warn(`[AI Service] 图片 ${i + 1} 上传 freeimage 失败:`, uploadErr.message);
          }
        }
      }
      userMessage.images = imagesList.map((img) => ({ mime_type: img.mime_type, data: img.data }));
      logger.info(`[AI Service] 添加 ${imagesList.length} 张图片到消息`);
    }
    
    const messages = [
      { role: 'system', content: systemPromptWithKnowledge },
      userMessage
    ];

    // 使用AI提供商工厂发送请求
    const result = await aiProviderFactory.createChatCompletion({
      provider: provider || 'qenda', // 默认使用 QENDA 提供商
      messages: messages,
      max_tokens: 24000,
      temperature: 0.6
    });
    
    const aiResponse = result.content;
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
            output_type: outputType,
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
        const jsonString = jsonMatch[0];
        const parsedDataRaw = tryParseAiJson(jsonString);
        const parsedData = {
          ...parsedDataRaw,
          language_code: parsedDataRaw.language_code || languageCode || 'zh-CN'
        };
        
        // 验证 full_html 是否存在
        if (!parsedData.full_html || typeof parsedData.full_html !== 'string' || parsedData.full_html.trim().length === 0) {
          throw new Error('AI返回的 full_html 字段为空或无效');
        }

        // 验证 tags 格式，如果不是数组则设为空数组（不影响主体内容）
        if (parsedData.tags !== undefined && !Array.isArray(parsedData.tags)) {
          logger.warn(`[generateEducationalContent] tags 字段格式无效，使用空数组`, { tags: parsedData.tags, type: typeof parsedData.tags });
          parsedData.tags = [];
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
              output_type: outputType,
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
    if (imageUrlResults.length > 0) {
      parsedData.image_urls = imageUrlResults;
      parsedData.image_url = imageUrlResults[0].url;
      parsedData.image_displayUrl = imageUrlResults[0].displayUrl;
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
              output_type: outputType,
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
          details: `解析错误: ${parseError.message}`
        };
      }
    } else {
      logger.error(`[generateEducationalContent JSON解析] 未找到JSON格式`);
      
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
            output_type: outputType,
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
}

注意：tags 必须是 JSON 数组格式，例如 ["数学", "几何"]。如果格式不正确，请返回空数组 []。`, '{{knowledge_point}}', knowledgePoint);

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
        const jsonString = jsonMatch[0];
        parsedData = tryParseAiJson(jsonString);
        
        // 验证 full_html 是否存在
        if (!parsedData.full_html || typeof parsedData.full_html !== 'string' || parsedData.full_html.trim().length === 0) {
          throw new Error('AI返回的 full_html 字段为空或无效');
        }
        
        // 验证 tags 格式，如果不是数组则设为空数组（不影响主体内容）
        if (parsedData.tags !== undefined && !Array.isArray(parsedData.tags)) {
          logger.warn(`[generateSimpleContent] tags 字段格式无效，使用空数组`, { tags: parsedData.tags, type: typeof parsedData.tags });
          parsedData.tags = [];
        }
        
        parsedData.full_html = replaceLibrariesInHtml(parsedData.full_html);
        
        return {
          success: true,
          data: parsedData,
          learningStage: LEARNING_STAGE_NAMES[learningStage]
        };
      } else {
        logger.error(`[generateSimpleContent JSON解析] 未找到JSON格式`);
        throw new Error('无法解析AI返回的JSON，请检查AI返回的格式');
      }
    } catch (parseError) {
      logger.error(`[generateSimpleContent JSON解析失败]`, {
        error_message: parseError.message
      });
      
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
    - For math formulas, keep TeX directly in the HTML (e.g. $...$, $$...$$, or data-tex/data-katex attributes) and let the host platform handle rendering; do not introduce new global math managers, MutationObserver-based math auto-renderers, or empty math container divs that are later filled by custom renderMath/katex.render loops.
    - CRITICAL: DO NOT use overflow: hidden on body element. Ensure vertical scrolling is available on small screens.
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
        const jsonString = jsonMatch[0];
        parsed = tryParseAiJson(jsonString);
        
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
        logger.error(`[fixEducationalContent JSON解析] 未找到JSON格式`);
        throw new Error('AI返回内容无法解析，请检查AI返回的格式');
      }
    } catch (e) {
      logger.error(`[fixEducationalContent JSON解析失败]`, {
        error_message: e.message
      });
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

// 获取支持的输出类型
const getSupportedOutputTypes = () => {
  return Object.keys(OUTPUT_TYPE_CONFIGS).map(key => ({
    value: key,
    label: OUTPUT_TYPE_CONFIGS[key].name,
    label_en: OUTPUT_TYPE_CONFIGS[key].name_en,
    description: OUTPUT_TYPE_CONFIGS[key].description
  }));
};

// 验证输出类型
const validateOutputType = (outputType) => {
  return Object.keys(OUTPUT_TYPE_CONFIGS).includes(outputType);
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
  getSupportedOutputTypes,
  validateOutputType,
  OUTPUT_TYPE_CONFIGS,
  getSystemPrompt, // 导出系统提示词生成函数
  fixEducationalContent,
  safeReplace,  // 导出安全替换函数供测试使用
  testSafeReplace,  // 导出测试函数
  aiProviderFactory, // 导出AI提供商工厂
  router // 导出路由
}; 