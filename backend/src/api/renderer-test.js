const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const DatabaseService = require('../services/database');
const { createRendererEngine } = require('../services/rendererEngine');
const logger = require('../utils/logger');

/**
 * Renderer 测试 API
 *
 * 使用方式：在前端「renderer-test」页面中可视化操作：
 *   - 用 short_id 加载内容（左侧=基准 response_metadata，右侧=content.full_html）
 *   - 点击「修复」对左侧 HTML 调用 POST /api/renderer-test/fix，结果写入右侧并自动切换渲染预览到修复结果
 *   - 在页面底部「渲染预览」中直接查看修复后的渲染效果，确认无误后可保存到 content.full_html
 *
 * 修复逻辑说明：
 *   - 无公式的 Vue 多阶段内容不会注入 MathRenderManager，避免破坏拖拽等交互
 *   - LibraryFixer 仅按 issue 类型做单项修复（补 fallback / 去重 / 注入缺失库），不做全量脚本重排，避免破坏可渲染内容
 */

/**
 * 根据 short_id 获取 full_html
 * GET /api/renderer-test/content/:short_id
 */
router.get('/content/:short_id', optionalAuth, async (req, res) => {
  try {
    const { short_id } = req.params;
    
    const { data: content, error } = await DatabaseService.supabase
      .from('content')
      .select('id, short_id, title, full_html')
      .eq('short_id', short_id)
      .single();
    
    if (error || !content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: content.id,
        short_id: content.short_id,
        title: content.title,
        full_html: content.full_html
      }
    });
  } catch (error) {
    logger.error('[Renderer Test API] 获取内容失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 根据 content_id 从 ai_usage_logs 的 response_metadata 中提取 full_html
 * GET /api/renderer-test/metadata-by-content/:content_id
 * 注意：这是测试工具，允许访问所有记录
 */
router.get('/metadata-by-content/:content_id', optionalAuth, async (req, res) => {
  try {
    const { content_id } = req.params;
    
    // 从数据库查询日志（仅生成记录，按创建时间倒序，取最新的）
    const { data: logData, error: queryError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('content_id', content_id)
      .eq('action_type', 'generate')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (queryError || !logData) {
      return res.status(404).json({
        success: false,
        error: '未找到对应的生成记录',
        content_id
      });
    }
    
    // 解析 response_metadata 提取 full_html（复用之前的逻辑）
    let fullHtml = null;
    let parseError = null;
    let parsePath = null;
    
    if (logData.response_metadata) {
      try {
        const metadata = typeof logData.response_metadata === 'string' 
          ? JSON.parse(logData.response_metadata) 
          : logData.response_metadata;
        
        // 尝试多种路径提取 full_html
        // 1. 直接从 metadata 中获取
        if (metadata.full_html) {
          fullHtml = metadata.full_html;
          parsePath = 'metadata.full_html';
        }
        // 2. 从 raw 中提取（Gemini/Qenda 格式）
        else if (metadata.raw) {
          const raw = metadata.raw;
          // Gemini/Qenda 格式: raw.candidates[0].content.parts[0].text
          if (raw.candidates && raw.candidates[0] && raw.candidates[0].content) {
            const parts = raw.candidates[0].content.parts || [];
            for (const part of parts) {
              if (part.text) {
                let text = part.text;
                
                // 尝试从文本中提取 JSON（支持代码块格式）
                let jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (!jsonMatch) {
                  jsonMatch = text.match(/```\s*(\{[\s\S]*?\})\s*```/);
                }
                if (!jsonMatch) {
                  jsonMatch = text.match(/\{[\s\S]*\}/);
                }
                
                if (jsonMatch) {
                  try {
                    const jsonString = jsonMatch[1] || jsonMatch[0];
                    const parsed = JSON.parse(jsonString);
                    if (parsed.full_html) {
                      fullHtml = parsed.full_html;
                      parsePath = 'raw.candidates[0].content.parts[0].text (JSON code block)';
                      break;
                    }
                  } catch (e) {
                    logger.debug('[Renderer Test API] JSON 解析失败', { error: e.message });
                  }
                }
              }
            }
          }
          // OpenAI 格式: raw.choices[0].message.content
          else if (raw.choices && raw.choices[0] && raw.choices[0].message) {
            const content = raw.choices[0].message.content;
            if (content) {
              let jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
              if (!jsonMatch) {
                jsonMatch = content.match(/```\s*(\{[\s\S]*?\})\s*```/);
              }
              if (!jsonMatch) {
                jsonMatch = content.match(/\{[\s\S]*\}/);
              }
              
              if (jsonMatch) {
                try {
                  const jsonString = jsonMatch[1] || jsonMatch[0];
                  const parsed = JSON.parse(jsonString);
                  if (parsed.full_html) {
                    fullHtml = parsed.full_html;
                    parsePath = 'raw.choices[0].message.content (JSON code block)';
                  }
                } catch (e) {
                  logger.debug('[Renderer Test API] OpenAI 格式 JSON 解析失败', { error: e.message });
                }
              }
            }
          }
        }
        // 3. 从 response_meta 中提取
        else if (metadata.response_meta) {
          const responseMeta = typeof metadata.response_meta === 'string'
            ? JSON.parse(metadata.response_meta)
            : metadata.response_meta;
          
          if (responseMeta.full_html) {
            fullHtml = responseMeta.full_html;
            parsePath = 'response_meta.full_html';
          }
        }
      } catch (error) {
        parseError = error.message;
        logger.warn('[Renderer Test API] 解析 response_metadata 失败', { 
          error: error.message,
          content_id
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        content_id: logData.content_id,
        request_id: logData.request_id,
        full_html: fullHtml,
        parse_error: parseError,
        parse_path: parsePath,
        has_metadata: !!logData.response_metadata
      }
    });
  } catch (error) {
    logger.error('[Renderer Test API] 获取 metadata 失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 根据 request_id 从 response_metadata 中提取 full_html
 * GET /api/renderer-test/metadata/:request_id
 * 注意：这是测试工具，允许访问所有记录
 */
router.get('/metadata/:request_id', optionalAuth, async (req, res) => {
  try {
    const { request_id } = req.params;
    const userId = req.user?.id;
    
    // 从数据库查询日志（仅生成记录）
    const { data: logData, error: queryError } = await DatabaseService.supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('request_id', request_id)
      .eq('action_type', 'generate')
      .single();
    
    if (queryError || !logData) {
      return res.status(404).json({
        success: false,
        error: '未找到对应的生成记录'
      });
    }
    
    // 测试工具：允许访问所有记录，不进行权限检查
    // 如果需要限制，可以取消下面的注释
    // if (userId && logData.user_id !== userId) {
    //   return res.status(403).json({
    //     success: false,
    //     error: '无权访问此记录'
    //   });
    // }
    
    // 解析 response_metadata 提取 full_html
    let fullHtml = null;
    let parseError = null;
    let parsePath = null;
    
    if (logData.response_metadata) {
      try {
        const metadata = typeof logData.response_metadata === 'string' 
          ? JSON.parse(logData.response_metadata) 
          : logData.response_metadata;
        
        // 尝试多种路径提取 full_html
        // 1. 直接从 metadata 中获取
        if (metadata.full_html) {
          fullHtml = metadata.full_html;
          parsePath = 'metadata.full_html';
        }
        // 2. 从 raw 中提取（Gemini/Qenda 格式）
        else if (metadata.raw) {
          const raw = metadata.raw;
          // Gemini/Qenda 格式: raw.candidates[0].content.parts[0].text
          if (raw.candidates && raw.candidates[0] && raw.candidates[0].content) {
            const parts = raw.candidates[0].content.parts || [];
            for (const part of parts) {
              if (part.text) {
                let text = part.text;
                
                // 尝试从文本中提取 JSON（支持代码块格式）
                // 1. 尝试匹配 ```json ... ``` 代码块
                let jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (!jsonMatch) {
                  // 2. 尝试匹配 ``` ... ``` 代码块（无语言标识）
                  jsonMatch = text.match(/```\s*(\{[\s\S]*?\})\s*```/);
                }
                if (!jsonMatch) {
                  // 3. 尝试匹配纯 JSON 对象
                  jsonMatch = text.match(/\{[\s\S]*\}/);
                }
                
                if (jsonMatch) {
                  try {
                    const jsonString = jsonMatch[1] || jsonMatch[0];
                    const parsed = JSON.parse(jsonString);
                    if (parsed.full_html) {
                      fullHtml = parsed.full_html;
                      parsePath = 'raw.candidates[0].content.parts[0].text (JSON code block)';
                      break;
                    }
                  } catch (e) {
                    // 继续尝试下一个 part
                    logger.debug('[Renderer Test API] JSON 解析失败，尝试下一个 part', { 
                      error: e.message,
                      jsonSnippet: jsonMatch[0].substring(0, 200)
                    });
                  }
                }
              }
            }
          }
          // OpenAI 格式: raw.choices[0].message.content
          else if (raw.choices && raw.choices[0] && raw.choices[0].message) {
            const content = raw.choices[0].message.content;
            if (content) {
              // 尝试从文本中提取 JSON（支持代码块格式）
              let jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
              if (!jsonMatch) {
                jsonMatch = content.match(/```\s*(\{[\s\S]*?\})\s*```/);
              }
              if (!jsonMatch) {
                jsonMatch = content.match(/\{[\s\S]*\}/);
              }
              
              if (jsonMatch) {
                try {
                  const jsonString = jsonMatch[1] || jsonMatch[0];
                  const parsed = JSON.parse(jsonString);
                  if (parsed.full_html) {
                    fullHtml = parsed.full_html;
                    parsePath = 'raw.choices[0].message.content (JSON code block)';
                  }
                } catch (e) {
                  logger.debug('[Renderer Test API] OpenAI 格式 JSON 解析失败', { error: e.message });
                }
              }
            }
          }
        }
        // 3. 从 response_meta 中提取
        else if (metadata.response_meta) {
          const responseMeta = typeof metadata.response_meta === 'string'
            ? JSON.parse(metadata.response_meta)
            : metadata.response_meta;
          
          if (responseMeta.full_html) {
            fullHtml = responseMeta.full_html;
            parsePath = 'response_meta.full_html';
          }
        }
      } catch (error) {
        parseError = error.message;
        logger.warn('[Renderer Test API] 解析 response_metadata 失败', { 
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        request_id: logData.request_id,
        full_html: fullHtml,
        parse_error: parseError,
        parse_path: parsePath,
        has_metadata: !!logData.response_metadata,
        metadata_keys: logData.response_metadata ? Object.keys(
          typeof logData.response_metadata === 'string' 
            ? JSON.parse(logData.response_metadata) 
            : logData.response_metadata
        ) : []
      }
    });
  } catch (error) {
    logger.error('[Renderer Test API] 获取 metadata 失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 使用 rendererEngine 修复 HTML
 * POST /api/renderer-test/fix
 * 注意：这是测试工具，允许未登录用户使用
 */
router.post('/fix', optionalAuth, async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html || typeof html !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'html 参数是必需的且必须是字符串'
      });
    }
    
    logger.info('[Renderer Test API] 开始修复 HTML', { htmlLength: html.length });
    
    // 使用 Renderer Engine 处理
    const rendererEngine = createRendererEngine();
    const result = await rendererEngine.process(html, {
      autoFix: true,
      maxFixAttempts: 3
    });
    
    logger.info('[Renderer Test API] 修复完成', {
      issuesDetected: result.report?.summary?.issuesDetected || 0,
      issuesFixed: result.report?.summary?.issuesFixed || 0,
      duration: result.report?.summary?.duration || 0
    });
    
    res.json({
      success: true,
      data: {
        originalHtml: html,
        fixedHtml: result.html,
        report: result.report,
        fixes: result.fixes || [],
        unfixedIssues: result.unfixedIssues || []
      }
    });
  } catch (error) {
    logger.error('[Renderer Test API] 修复失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
