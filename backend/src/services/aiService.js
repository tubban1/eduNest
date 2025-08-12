const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

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
- Use Tone.js v14.8.49 when audio feedback, sound effects, or music would enhance the learning experience*:
  https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js
- Use Web Speech API when appropriate to enhance comprehension through voice narration or speech recognition (e.g., pronunciation, instructions, responses).
- All additional dependencies must be loaded via production-ready CDN (e.g., unpkg, cdnjs).
- Avoid any build tools or .vue files.
Everything must work in plain HTML/CSS/JS, and run directly in environments like sandbox editors or iframes.

3. UX/UI Requirements
- Ensure the UI is responsive, touch-friendly, and optimized for both desktop and mobile.
- Use animations, transitions, and interactive visual metaphors to aid engagement and comprehension.
- Use sound and visual feedback where pedagogically helpful for user interactions (e.g., success, fail, progress, guidance).
- The layout should be minimal, accessible, and focused on content.

4. Output Format
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
  ],
  "tags": [
    "3–7 high-quality tags that reflect subject, domain, format, or interaction style"
  ],
  "content_type": "vue",
  "language": "zh-CN"
}

5. Language
If no explicit language is provided, you must automatically infer the correct output language by analyzing the input "{{knowledge_point}}".  
Ensure that all output text—including the title, description, UI strings, and comments—is written in the same language that best matches the "{{knowledge_point}}".
Do not default to any single language (e.g., Chinese or English). Use your best judgment to match the language of the "{{knowledge_point}}".
The final JSON must also include the "language" field in BCP 47 format (e.g., zh-CN, en-US, de-CH) based on your inferred language.

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
const generateEducationalContent = async (knowledgePoint, learningStage, description = '') => {
  try {
    if (!ARK_API_KEY || ARK_API_KEY === 'your_ark_api_key_here') {
      throw new Error('ARK_API_KEY未配置或使用默认值，请在.env文件中配置真实的API密钥');
    }

    // 构建完整的提示词
    const userPrompt = LEARNING_STAGE_PROMPTS[learningStage].replace('{{knowledge_point}}', knowledgePoint);
    const systemPromptWithKnowledge = SYSTEM_PROMPT.replace('{{knowledge_point}}', knowledgePoint);

    const response = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: systemPromptWithKnowledge },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('AI返回内容为空');
    }

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
        console.log('找到JSON匹配，长度:', jsonMatch[0].length);
        console.log('JSON内容:', jsonMatch[0]);
        parsedData = JSON.parse(jsonMatch[0]);
        console.log('解析后的数据:', parsedData);
      } else {
        console.error('无法找到JSON结构，原始内容:', aiResponse);
        throw new Error('无法解析AI返回的JSON，请检查AI返回的格式');
      }
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('尝试解析的内容:', jsonMatch ? jsonMatch[0] : '未找到JSON');
      throw new Error(`AI返回内容格式错误: ${parseError.message}`);
    }

    // 验证必要字段
    if (!parsedData.html || !parsedData.css || !parsedData.js) {
      throw new Error('AI返回的内容缺少必要字段(html, css, js)');
    }

    return {
      success: true,
      data: {
        html: parsedData.html,
        css: parsedData.css,
        js: parsedData.js,
        title: parsedData.title || 'AI生成的内容',
        description: parsedData.description || description,
        tags: parsedData.tags || [],
        external_links: parsedData.external_links || [],
        content_type: parsedData.content_type || 'vue',
        language: parsedData.language || 'zh-CN'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'AI生成失败'
    };
  }
};

// 简化的AI生成测试
const generateSimpleContent = async (knowledgePoint, learningStage) => {
  try {
    console.log('简化AI生成开始:', { knowledgePoint, learningStage });

    if (!ARK_API_KEY || ARK_API_KEY === 'your_ark_api_key_here') {
      throw new Error('ARK_API_KEY未配置或使用默认值，请在.env文件中配置真实的API密钥');
    }

    // 简化的提示词
    const simplePrompt = `请为知识点"${knowledgePoint}"创建一个简单的Vue 3交互式教育项目。学习阶段：${learningStage}。

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
  "language": "zh-CN"
}`;

    console.log('发送简化请求到AI');

    const response = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'user', content: simplePrompt }
        ]
      })
    });

    console.log('AI API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API错误:', errorText);
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('AI API原始响应:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('AI API返回格式错误');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('AI原始响应:', aiResponse);
    console.log('AI响应长度:', aiResponse.length);

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
        console.log('找到JSON匹配，长度:', jsonMatch[0].length);
        console.log('JSON内容:', jsonMatch[0]);
        parsedData = JSON.parse(jsonMatch[0]);
        console.log('解析后的数据:', parsedData);
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
const fixEducationalContent = async ({ html, css, js, external_links, note, content_type, language, title, description }) => {
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
      
    const USER_PROMPT = `The current Vue 3 project has the following issue or user request:\n${note}\n\nCurrent code:\n{\n  \"html\": \"${html.replace(/"/g, '\\"')}\",\n  \"css\": \"${css ? css.replace(/"/g, '\\"') : ''}\",\n  \"js\": \"${js.replace(/"/g, '\\"')}\",\n  \"external_links\": ${JSON.stringify(external_links || [])}\n}`;
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
          { role: 'user', content: USER_PROMPT }
        ]
      })
    });
    if (!response.ok) {
      return { success: false, error: `AI API请求失败: ${response.status}` };
    }
    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      return { success: false, error: 'AI返回内容为空' };
    }
    
    console.log('AI修复原始返回内容:', aiResponse);
    console.log('AI修复返回内容长度:', aiResponse.length);
    
    let parsed;
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
        console.log('找到修复JSON匹配:', jsonMatch[0]);
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error('无法找到修复JSON结构，原始内容:', aiResponse);
        throw new Error('AI返回内容无法解析，请检查AI返回的格式');
      }
    } catch (e) {
      console.error('修复JSON解析错误:', e);
      console.error('尝试解析的内容:', jsonMatch ? jsonMatch[0] : '未找到JSON');
      return { success: false, error: `AI返回内容格式错误: ${e.message}` };
    }
    return { success: true, data: parsed };
  } catch (e) {
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

module.exports = {
  generateEducationalContent,
  getSupportedLearningStages,
  getLearningStageDescription,
  validateLearningStage,
  LEARNING_STAGE_NAMES,
  fixEducationalContent,
  generateSimpleContent
}; 