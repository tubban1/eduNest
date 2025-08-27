const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { logAIUsage } = require('./database');
const express = require('express');
const router = express.Router();
const { supabase } = require('./database');

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

// AI服务配置
const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_MODEL = process.env.ARK_MODEL || 'kimi-k2-250711';
const ARK_URL = process.env.ARK_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 系统提示词（来自AI_KNOWLEDGE.md）
const SYSTEM_PROMPT = `You are an expert Vue 3 educational interaction designer and frontend engineer.

Your task is to generate an interactive Vue 3 project that visually, audibly, and interactively teaches a specific knowledge point through one of the following learning stages:
understanding, application, assessment, expansion, or gamify.

Your design must ensure:

1. Educational Quality
- The input "{{knowledge_point}}" must be accurately and deeply explained, not superficial.
- Structure the presentation to reflect a clear conceptual breakdown, including:
-- Key principles and their relationships
-- Edge cases or common misunderstandings (where relevant)
-- Gradual progression or scaffolding to support layered understanding
-Use metaphor, visualization, sound cues, and interaction to reinforce mental models.

2. Technical Constraints
- The project must be fully runnable in a browser-based sandbox that uses three code panes: HTML, CSS, JavaScript.
- Ensure the CSS and JS fields are fully populated with working, complete, and runnable code. The HTML field must not include any <style> or <script> tags. External links must be declared in the external_links field.
- Use Vue 3 with <script setup> syntax via production CDN:
https://unpkg.com/vue@3/dist/vue.global.prod.js
- In addition, you may autonomously choose one or more additional libraries from the following list if they improve the pedagogical effect (e.g. animation, charts, audio, 3D):
Vue.js: Vue, VueRouter, Vuex
React: Redux
Sound: Tone.js, Howler.js
Animation: Anime.js, GSAP
3D: Three.js, Babylon.js
Charts: Chart.js, ECharts
Tools: Lodash, Moment.js, Day.js
Form: VeeValidate, VeeValidate Rules, VeeValidate i18n
- Use Web Speech API when appropriate to enhance comprehension through voice narration or speech recognition (e.g., pronunciation, instructions, responses).
- All additional dependencies must be loaded via production-ready CDN (e.g., unpkg, cdnjs, jsdelivr).
- Avoid any build tools or .vue files.
Everything must work in plain HTML/CSS/JS, and run directly in environments like sandbox editors or iframes.

3. UX/UI Requirements
- Ensure the UI is responsive, touch-friendly, and optimized for both desktop and mobile.
- Use animations, transitions, and interactive visual metaphors to aid engagement and comprehension.
- Use sound and visual feedback where pedagogically helpful for user interactions (e.g., success, fail, progress, guidance).
- The layout should be minimal, accessible, and focused on content.

4. Output Language Constraint
- Language_code is: {{fallback_language}}.
- The language_code must be included as a field in the final JSON output and must be a valid BCP 47 code string (e.g., "zh-CN", "en-US", "de-CH").
- All text values in the JSON (including title, description, UI strings, tags and comments) must match the language indicated by language_code.

5. Output Format
Return the result as a single, valid, and minified JSON object. Strictly adhere to the specified structure below, with no leading or trailing text. The entire output must be parseable as a single JSON object. Any deviation, such as a missing comma, unclosed quote, or bracket, is a critical error.

{
  "title": "Title of the project",
  "description": "What this project teaches and how to interact with it",
  "html": "<!-- Full, complete, and runnable HTML code, including all necessary CDN script tags. -->",
  "css": "/* Full, complete, and runnable CSS code */",
  "js": "// Full, complete, and runnable JS code using Vue 3 <script setup>, with all functions and components properly closed.",
  "external_links": [
    "https://unpkg.com/vue@3/dist/vue.global.prod.js",
    "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js" *if used*
    "Any additional library links you actually used from the allowed list"
  ],
  "tags": [
    "3–7 high-quality tags that reflect subject, domain, format, or interaction style"
  ],
  "content_type": "vue",
  "language_code": "MUST match the language_code input parameter exactly as per Constraint 4"
}

6. Only return the final JSON. Do not include explanations, instructions, or additional output beyond the required format.`;

// 学习阶段的用户提示词映射
const LEARNING_STAGE_PROMPTS = {
  understanding: `Create an interactive project that visually and audibly explains the concept of "{{knowledge_point}}".
Use animated diagrams, gentle ambient sounds, and user-driven actions like hovering or clicking to highlight different parts.
Ensure users can explore the concept in steps, with each stage accompanied by sound or animation cues.`,

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
const generateEducationalContent = async (knowledgePoint, learningStage, description = '', languageCode = '', userId = null, actionType = 'generate') => {
  let logId = null;
  let logParams = {};
  try {
    if (!ARK_API_KEY || ARK_API_KEY === 'your_ark_api_key_here') {
      throw new Error('ARK_API_KEY未配置或使用默认值，请在.env文件中配置真实的API密钥');
    }
    // 构建完整的提示词
    const userPrompt = safeReplace(LEARNING_STAGE_PROMPTS[learningStage], '{{knowledge_point}}', knowledgePoint);
    let systemPromptWithKnowledge = safeReplace(SYSTEM_PROMPT, '{{knowledge_point}}', knowledgePoint);
    if (languageCode) {
      systemPromptWithKnowledge = safeReplace(systemPromptWithKnowledge, '{{fallback_language}}', languageCode);
    } else {
      systemPromptWithKnowledge = safeReplace(systemPromptWithKnowledge, '{{fallback_language}}', 'en-US');
    }
    const requestPayload = {
      model: ARK_MODEL,
      messages: [
        { role: 'system', content: systemPromptWithKnowledge },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 24000
    };
    const response = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(requestPayload)
    });
    const createdAt = Date.now() / 1000;
    if (!response.ok) {
      // 记录失败日志
      await logAIUsage({
        user_id: userId,
        model_name: ARK_MODEL,
        user_query: knowledgePoint,
        action_type: actionType,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        request_payload: requestPayload,
        response_metadata: { status: response.status, statusText: response.statusText },
        created_at: new Date(),
        is_json_valid: false,
        is_render_success: false,
        error_message: `AI API请求失败: ${response.status} ${response.statusText}`
      });
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    // tokens字段名修正，全部用prompt_tokens/completion_tokens/total_tokens
    const usage = data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    if (!aiResponse) {
      await logAIUsage({
        user_id: userId,
        model_name: ARK_MODEL,
        user_query: knowledgePoint,
        action_type: actionType,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        request_payload: requestPayload,
        response_metadata: data,
        created_at: new Date(),
        is_json_valid: false,
        is_render_success: false,
        error_message: 'AI返回内容为空'
      });
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
        // 日志：成功解析JSON
        await logAIUsage({
          user_id: userId,
          model_name: ARK_MODEL,
          user_query: knowledgePoint,
          action_type: actionType,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: requestPayload,
          response_metadata: data,
          created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
          is_json_valid: true,
          is_render_success: false,
          error_message: null
        });
    return {
      success: true,
          data: parsedData
        };
      } catch (parseError) {
        await logAIUsage({
          user_id: userId,
          model_name: ARK_MODEL,
          user_query: knowledgePoint,
          action_type: actionType,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_payload: requestPayload,
          response_metadata: data,
          created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
          is_json_valid: false,
          is_render_success: false,
          error_message: `JSON解析失败: ${parseError.message}`
        });
        return {
          success: false,
          error: 'JSON解析失败',
          details: `解析错误: ${parseError.message}，AI返回内容长度: ${aiResponse.length}`
        };
      }
    } else {
      await logAIUsage({
        user_id: userId,
        model_name: ARK_MODEL,
        user_query: knowledgePoint,
        action_type: actionType,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        request_payload: requestPayload,
        response_metadata: data,
        created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
        is_json_valid: false,
        is_render_success: false,
        error_message: '未找到JSON格式'
      });
      return {
        success: false,
        error: '未找到JSON格式',
        details: `AI返回的内容中没有找到有效的JSON结构，内容长度: ${aiResponse.length}`
      };
    }
  } catch (error) {
    // 捕获主流程异常
    await logAIUsage({
      user_id: null,
      model_name: ARK_MODEL,
      user_query: null,
      action_type: 'generate',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      request_payload: null,
      response_metadata: null,
      created_at: new Date(),
      is_json_valid: false,
      is_render_success: false,
      error_message: error.message || 'AI生成失败'
    });
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
  "html": "<div id='app'>{{ message }}</div>",
  "css": "body { font-family: sans-serif; } #app { padding: 20px; }",
  "js": "const { createApp } = Vue; createApp({ data() { return { message: 'Hello World!' } } }).mount('#app');",
  "external_links": ["https://unpkg.com/vue@3/dist/vue.global.prod.js"],
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
      } else {
        console.error('未找到JSON格式，完整响应:', aiResponse);
        throw new Error('无法解析AI返回的JSON，请检查AI返回的格式');
      }
    } catch (parseError) {
      console.error('AI返回内容解析失败:', parseError);
      console.error('AI原始响应内容:', aiResponse);
      throw new Error(`AI返回内容格式错误: ${parseError.message}`);
    }

    return {
      success: true,
      data: parsedData,
      learningStage: LEARNING_STAGE_NAMES[learningStage]
    };

  } catch (error) {
    console.error('简化AI生成错误:', error);
    return {
      success: false,
      error: error.message || '简化AI生成失败'
    };
  }
};

// AI修复接口
const fixEducationalContent = async ({ html, css, js, external_links, note, content_type, language_code, title, description, user_id = null }) => {
  let logParams = {};
  try {
    // 构建修复prompt
    const SYSTEM_PROMPT = `You are an expert Vue 3 frontend developer and educational UI engineer.
    Your task is to fix and improve an interactive Vue 3 educational project.
    Only modify the following fields in the provided JSON:
    - html
    - css
    - js
    - external_links
    - fixed
    Constraints:
    - Use Vue 3 with <script setup> style via production CDN: https://unpkg.com/vue@3/dist/vue.global.prod.js
    - UUse Tone.js v14.8.49 when audio feedback, sound effects, or music would enhance the learning experience:
  https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js
    - Use Web Speech API when appropriate to enhance comprehension through voice narration or speech recognition (e.g., pronunciation, instructions, responses).
    - All code must be runnable in a browser-based sandbox with three panes: HTML, CSS, JavaScript.
    - No build tools, bundlers, or .vue files are allowed.
    - All external libraries must be loaded via production CDN (e.g., unpkg, cdnjs).
    - Ensure mobile and desktop compatibility.
    - Only output valid JSON with the following format: 
    {
      "html": "...",
      "css": "...",
      "js": "...",
      "external_links": ["..."],
      "fixed": "a short non-technical summary of what was changed or fixed (1-2 sentences)"
      }
      If you receive error logs, fix the specific issue.
      If you receive a user modification note, apply it as a functional update or enhancement.
      Do not change project structure or title. Focus only on fixing code or updating interactivity/behavior.`;
      
    const USER_PROMPT = safeReplace(`The current Vue 3 project has the following issue or user request:\n{{note}}\n\nCurrent code:\n{\n  \"html\": \"{{html}}\",\n  \"css\": \"{{css}}\",\n  \"js\": \"{{js}}\",\n  \"external_links\": {{external_links}}\n}`, '{{note}}', note);

    const finalUserPrompt = safeReplace(USER_PROMPT, '{{html}}', html)
      .replace('{{css}}', css ? css : '')
      .replace('{{js}}', js)
      .replace('{{external_links}}', JSON.stringify(external_links || []));

    const response = await fetch(process.env.ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ARK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: finalUserPrompt }
        ],
        max_tokens: 24000
      })
    });
    const createdAt = Date.now() / 1000;
    if (!response.ok) {
      const usage = data.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || 0;
      await logAIUsage({
        user_id,
        model_name: process.env.ARK_MODEL,
        user_query: note,
        action_type: 'fix',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        request_payload: { html, css, js, external_links, note, content_type, language_code, title, description },
        response_metadata: { status: response.status, statusText: response.statusText },
        created_at: new Date(),
        is_json_valid: false,
        is_render_success: false,
        error_message: `AI API请求失败: ${response.status} ${response.statusText}`
      });
      return { success: false, error: `AI API请求失败: ${response.status}` };
    }
    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    if (!aiResponse) {
      await logAIUsage({
        user_id,
        model_name: process.env.ARK_MODEL,
        user_query: note,
        action_type: 'fix',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        request_payload: { html, css, js, external_links, note, content_type, language_code, title, description },
        response_metadata: data,
        created_at: new Date(),
        is_json_valid: false,
        is_render_success: false,
        error_message: 'AI返回内容为空'
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
        await logAIUsage({
          user_id,
          model_name: process.env.ARK_MODEL,
          user_query: note,
          action_type: 'fix',
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          total_tokens: totalTokens,
          request_payload: { html, css, js, external_links, note, content_type, language_code, title, description },
          response_metadata: data,
          created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
          is_json_valid: true,
          is_render_success: false,
          error_message: null
        });
      } else {
        await logAIUsage({
          user_id,
          model_name: process.env.ARK_MODEL,
          user_query: note,
          action_type: 'fix',
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          total_tokens: totalTokens,
          request_payload: { html, css, js, external_links, note, content_type, language_code, title, description },
          response_metadata: data,
          created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
          is_json_valid: false,
          is_render_success: false,
          error_message: '未找到JSON格式'
        });
        console.error('无法找到修复JSON结构，原始内容:', aiResponse);
        throw new Error('AI返回内容无法解析，请检查AI返回的格式');
      }
    } catch (e) {
      await logAIUsage({
        user_id,
        model_name: process.env.ARK_MODEL,
        user_query: note,
        action_type: 'fix',
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        request_payload: { html, css, js, external_links, note, content_type, language_code, title, description },
        response_metadata: data,
        created_at: new Date(data.created_at ? data.created_at * 1000 : Date.now()),
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
    await logAIUsage({
      user_id: null,
      model_name: process.env.ARK_MODEL,
      user_query: null,
      action_type: 'fix',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      request_payload: null,
      response_metadata: null,
      created_at: new Date(),
      is_json_valid: false,
      is_render_success: false,
      error_message: e.message || 'AI修复失败'
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

module.exports = {
  generateEducationalContent,
  getSupportedLearningStages,
  getLearningStageDescription,
  validateLearningStage,
  LEARNING_STAGE_NAMES,
  fixEducationalContent,
  safeReplace,  // 导出安全替换函数供测试使用
  testSafeReplace  // 导出测试函数
}; 