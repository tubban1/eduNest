/**
 * LibraryFixer - 库引用自动修复器（增强版）
 * 
 * 功能：
 * - 检测缺失的依赖库并自动注入
 * - 替换为推荐的 CDN URL（基于 supported-libraries.json）
 * - 添加 onerror fallback 处理
 * - 修复重复库引用
 * - 确保正确的脚本加载顺序
 * 
 * 注：此模块从 aiService.js 中迁移并增强
 */

const path = require('path');
const fs = require('fs');
const logger = require('../../../utils/logger');

// 缓存
let supportedLibrariesCache = null;
let libraryEntriesCache = null;

/**
 * 加载 JSON 文件
 */
const loadJsonFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn(`[LibraryFixer] Failed to load ${filePath}: ${error.message}`);
    return null;
  }
};

/**
 * 获取完整的库配置
 */
const getSupportedLibraries = () => {
  if (!supportedLibrariesCache) {
    const supportedLibrariesPath = path.join(__dirname, '../../../../config/supported-libraries.json');
    supportedLibrariesCache = loadJsonFile(supportedLibrariesPath);
  }
  return supportedLibrariesCache;
};

/**
 * 将 supported-libraries.json 转换为扁平结构
 */
const buildLibraryEntries = (supportedLibraries) => {
  if (!supportedLibraries || !supportedLibraries.libraries) return [];

  const entries = [];
  for (const [key, lib] of Object.entries(supportedLibraries.libraries)) {
    if (!lib || !lib.versions) continue;

    // JS 库
    for (const [version, url] of Object.entries(lib.versions)) {
      entries.push({
        name: key,
        type: 'js',
        version,
        url,
        fallback: lib.fallback,
        patterns: lib.patterns || [],
        requires: lib.requires || [],
        priority: lib.priority || 50,
        detect: lib.detect || []
      });
    }

    // CSS 库
    if (lib.css) {
      for (const [version, url] of Object.entries(lib.css)) {
        entries.push({
          name: key,
          type: 'css',
          version,
          url,
          fallback: lib.cssFallback,
          patterns: lib.patterns || [],
          priority: lib.priority || 50
        });
      }
    }
  }

  return entries;
};

/**
 * 获取支持的库条目
 */
const getSupportedLibraryEntries = () => {
  if (!libraryEntriesCache) {
    const data = getSupportedLibraries();
    libraryEntriesCache = buildLibraryEntries(data);
  }
  return libraryEntriesCache;
};

/**
 * 获取 fallback 基础 URL
 */
const getFallbackBaseUrl = () => {
  const libs = getSupportedLibraries();
  return libs?.fallbackBaseUrl || 'https://tubban1.oss-cn-beijing.aliyuncs.com/static/lib';
};

/**
 * 从 URL 中提取库信息
 */
const extractLibraryInfo = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // 特殊处理：tailwindcss.com 等没有文件名的 CDN
  if (url.includes('cdn.tailwindcss.com')) {
    return {
      name: 'tailwindcss',
      version: null,
      file: 'tailwindcss.js'
    };
  }
  
  // 提取文件名
  const fileName = url.split('/').pop()?.split('?')[0];
  
  if (!fileName || (!fileName.endsWith('.js') && !fileName.endsWith('.css'))) {
    const pathMatch = url.match(/\/([^/]+\.(js|css))(?:\?|$)/i);
    if (pathMatch) {
      return {
        name: null,
        version: null,
        file: pathMatch[1]
      };
    }
    return null;
  }
  
  // 尝试从 URL 中提取库名和版本
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
  
  // 从文件名推断库名
  const nameFromFile = fileName
    .replace(/\.(min\.)?(js|css)$/i, '')
    .replace(/\.(global|prod|dev|bundle)/i, '')
    .split('.')[0];
  
  return {
    name: nameFromFile || null,
    version: null,
    file: fileName
  };
};

/**
 * 生成 fallback URL
 */
const generateFallbackUrl = (libraryInfo, type) => {
  if (!libraryInfo || !libraryInfo.file) return null;
  
  const baseUrl = getFallbackBaseUrl();
  return `${baseUrl}/${libraryInfo.file}`;
};

/**
 * 查找替换 URL
 */
const findReplacementUrl = (url, type) => {
  if (!url || typeof url !== 'string') return null;

  const entries = getSupportedLibraryEntries();
  if (!entries || !entries.length) return null;
  
  const matches = [];
  for (const entry of entries) {
    if (entry.type !== type) continue;
    if (!entry.patterns || !entry.patterns.length) continue;
    
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
  
  // 按 pattern 长度降序排序
  matches.sort((a, b) => b.patternLength - a.patternLength);
  
  const bestMatch = matches[0];
  if (bestMatch.url && bestMatch.url !== url) {
    return { url: bestMatch.url, entry: bestMatch.entry };
  }
  
  return null;
};

/**
 * 根据库名获取库配置
 */
const getLibraryConfig = (libraryName) => {
  const libs = getSupportedLibraries();
  if (!libs || !libs.libraries) return null;
  return libs.libraries[libraryName] || null;
};

/**
 * 获取库的默认版本 URL
 */
const getLibraryUrl = (libraryName) => {
  const config = getLibraryConfig(libraryName);
  if (!config || !config.versions) return null;
  
  // 返回第一个版本的 URL
  const versions = Object.values(config.versions);
  return versions[0] || null;
};

/**
 * 获取库的 fallback 文件名
 */
const getLibraryFallback = (libraryName) => {
  const config = getLibraryConfig(libraryName);
  return config?.fallback || null;
};

class LibraryFixer {
  constructor() {
    this.name = 'LibraryFixer';
    this.handles = [
      'CDN_UNREACHABLE',
      'LIBRARY_VERSION_MISMATCH',
      'DUPLICATE_LIBRARY',
      'MISSING_DEPENDENCY',
      'MISSING_FALLBACK',
      'LIBRARY_OPTIMIZE'
    ];
  }
  
  /**
   * 检查是否能修复这个问题
   */
  canFix(issue) {
    return this.handles.includes(issue.code);
  }
  
  /**
   * 执行修复（仅处理当前 issue 对应的一项，避免全量优化破坏原本可渲染的页面）
   */
  async fix(html, issue, context = {}) {
    if (typeof html !== 'string' || !html.trim()) {
      return { success: true, html, changes: [], explanation: 'HTML 为空，无需处理' };
    }
    const changes = [];
    let updatedHtml = html;

    switch (issue.code) {
      case 'MISSING_DEPENDENCY': {
        const name = issue.context?.libraryName || issue.context?.name;
        const reason = issue.context?.reason || '缺失依赖';
        if (name) {
          const missing = [{ name, reason, priority: 50 }];
          updatedHtml = this.injectMissingLibraries(updatedHtml, missing, changes);
        }
        return {
          success: true,
          html: updatedHtml,
          changes,
          explanation: changes.length > 0 ? `注入缺失的库: ${name}` : `未注入: ${name}`
        };
      }
      case 'DUPLICATE_LIBRARY':
        updatedHtml = this.removeDuplicateLibraries(updatedHtml, changes);
        return {
          success: true,
          html: updatedHtml,
          changes,
          explanation: changes.length > 0 ? `移除 ${changes.length} 处重复库引用` : '无重复库引用'
        };
      case 'MISSING_FALLBACK':
        updatedHtml = this.replaceScriptsWithFallback(updatedHtml, changes);
        updatedHtml = this.replaceLinksWithFallback(updatedHtml, changes);
        return {
          success: true,
          html: updatedHtml,
          changes,
          explanation: changes.length > 0 ? `为 ${changes.length} 处引用添加 fallback` : '已具备 fallback'
        };
      case 'CDN_UNREACHABLE':
      case 'LIBRARY_VERSION_MISMATCH':
      case 'LIBRARY_OPTIMIZE':
        updatedHtml = this.replaceScriptsWithFallback(updatedHtml, changes);
        updatedHtml = this.replaceLinksWithFallback(updatedHtml, changes);
        return {
          success: true,
          html: updatedHtml,
          changes,
          explanation: changes.length > 0 ? `优化了 ${changes.length} 处库引用` : '无需变更'
        };
      default:
        return {
          success: true,
          html,
          changes: [],
          explanation: `未处理的问题类型: ${issue.code}`
        };
    }
  }

  /**
   * 优化库引用（全量方法，仅用于非 issue 驱动的批量处理）
   */
  optimizeLibraries(html) {
    if (typeof html !== 'string' || !html.trim()) {
      return {
        success: true,
        html,
        changes: [],
        explanation: 'HTML 为空，无需处理'
      };
    }
    
    const changes = [];
    let updatedHtml = html;
    
    // 1. 分析当前已加载的库
    const loadedLibraries = this.analyzeLoadedLibraries(html);
    
    // 2. 检测代码中使用但未加载的库
    const missingLibraries = this.detectMissingLibraries(html, loadedLibraries);
    
    // 3. 注入缺失的库
    if (missingLibraries.length > 0) {
      updatedHtml = this.injectMissingLibraries(updatedHtml, missingLibraries, changes);
    }
    
    // 4. 检测并修复重复的库引用
    updatedHtml = this.removeDuplicateLibraries(updatedHtml, changes);
    
    // 5. 替换 script 标签并添加 fallback
    updatedHtml = this.replaceScriptsWithFallback(updatedHtml, changes);
    
    // 6. 替换 link 标签并添加 fallback
    updatedHtml = this.replaceLinksWithFallback(updatedHtml, changes);
    
    // 7. 修复脚本顺序问题
    updatedHtml = this.fixScriptOrder(updatedHtml, changes);
    
    return {
      success: true,
      html: updatedHtml,
      changes,
      explanation: changes.length > 0 
        ? `优化了 ${changes.length} 处库引用` 
        : '库引用已是最优状态'
    };
  }
  
  /**
   * 分析当前已加载的库
   */
  analyzeLoadedLibraries(html) {
    const loaded = new Set();
    const libs = getSupportedLibraries();
    if (!libs || !libs.libraries) return loaded;
    
    // 检查每个库是否已加载
    for (const [key, lib] of Object.entries(libs.libraries)) {
      if (lib.patterns) {
        for (const pattern of lib.patterns) {
          if (html.includes(pattern)) {
            loaded.add(key);
            break;
          }
        }
      }
    }
    
    return loaded;
  }
  
  /**
   * 检测代码中使用但未加载的库
   */
  detectMissingLibraries(html, loadedLibraries) {
    const missing = [];
    const libs = getSupportedLibraries();
    if (!libs || !libs.libraries) return missing;
    
    // 提取所有 script 内容
    const scriptContent = this.extractScriptContent(html);
    
    for (const [key, lib] of Object.entries(libs.libraries)) {
      // 如果已加载，检查其依赖
      if (loadedLibraries.has(key)) {
        if (lib.requires) {
          for (const dep of lib.requires) {
            if (!loadedLibraries.has(dep)) {
              missing.push({
                name: dep,
                reason: `${key} 依赖 ${dep}`,
                priority: libs.libraries[dep]?.priority || 50
              });
            }
          }
        }
        continue;
      }
      
      // 检测代码中是否使用了该库
      if (lib.detect) {
        for (const pattern of lib.detect) {
          // 检查精确匹配（大小写敏感）
          if (scriptContent.includes(pattern) || html.includes(pattern)) {
            missing.push({
              name: key,
              reason: `代码中检测到 ${pattern}`,
              priority: lib.priority || 50
            });
            
            // 同时添加其依赖
            if (lib.requires) {
              for (const dep of lib.requires) {
                if (!loadedLibraries.has(dep) && !missing.find(m => m.name === dep)) {
                  missing.push({
                    name: dep,
                    reason: `${key} 依赖 ${dep}`,
                    priority: libs.libraries[dep]?.priority || 50
                  });
                }
              }
            }
            break;
          }
          
          // 对于 OrbitControls，也进行大小写不敏感匹配（兼容 orbitControls、Orbit_Controls 等变体）
          if (key === 'three-orbit-controls' && (pattern === 'OrbitControls' || pattern === 'THREE.OrbitControls')) {
            const lowerPattern = pattern.toLowerCase();
            const lowerScriptContent = scriptContent.toLowerCase();
            const lowerHtml = html.toLowerCase();
            
            if (lowerScriptContent.includes(lowerPattern.replace('three.', 'three.')) || 
                lowerScriptContent.includes('orbitcontrol') || 
                lowerScriptContent.includes('orbit_control') ||
                lowerHtml.includes(lowerPattern)) {
              missing.push({
                name: key,
                reason: `代码中检测到 OrbitControls (大小写不敏感)`,
                priority: lib.priority || 50
              });
              
              if (lib.requires) {
                for (const dep of lib.requires) {
                  if (!loadedLibraries.has(dep) && !missing.find(m => m.name === dep)) {
                    missing.push({
                      name: dep,
                      reason: `${key} 依赖 ${dep}`,
                      priority: libs.libraries[dep]?.priority || 50
                    });
                  }
                }
              }
              break;
            }
          }
        }
      }
    }
    
    // 按优先级排序（priority 小的先加载）
    missing.sort((a, b) => a.priority - b.priority);
    
    // 去重
    const seen = new Set();
    return missing.filter(m => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  }
  
  /**
   * 提取所有 script 标签内的代码
   */
  extractScriptContent(html) {
    const scriptRegex = /<script\b[^>]*>([^<]*)<\/script>/gi;
    let content = '';
    let match;
    
    while ((match = scriptRegex.exec(html)) !== null) {
      content += match[1] + '\n';
    }
    
    return content;
  }
  
  /**
   * 注入缺失的库
   */
  injectMissingLibraries(html, missingLibraries, changes) {
    let updatedHtml = html;
    const baseUrl = getFallbackBaseUrl();
    
    for (const lib of missingLibraries) {
      const url = getLibraryUrl(lib.name);
      const fallbackFile = getLibraryFallback(lib.name);
      
      if (!url) {
        logger.warn(`[LibraryFixer] 无法找到库 ${lib.name} 的 URL`);
        continue;
      }
      
      const fallbackUrl = fallbackFile ? `${baseUrl}/${fallbackFile}` : null;
      
      // 构建 script 标签
      let scriptTag;
      if (fallbackUrl) {
        scriptTag = `<script src="${url}" onerror="this.onerror=null; this.src='${fallbackUrl}'"></script>`;
      } else {
        scriptTag = `<script src="${url}"></script>`;
      }
      
      // 找到合适的插入位置
      const insertPosition = this.findInsertPosition(updatedHtml, lib.name);
      
      if (insertPosition.type === 'after-script') {
        // 在某个 script 后插入
        updatedHtml = updatedHtml.replace(
          insertPosition.target,
          insertPosition.target + '\n    ' + scriptTag
        );
      } else {
        // 在 </head> 前插入
        updatedHtml = updatedHtml.replace(
          '</head>',
          `    ${scriptTag}\n</head>`
        );
      }
      
      changes.push({
        type: 'insert',
        location: insertPosition.type,
        after: scriptTag,
        reason: `注入缺失的库: ${lib.name} (${lib.reason})`
      });
      
      logger.info(`[LibraryFixer] 注入缺失的库: ${lib.name}`);
    }
    
    return updatedHtml;
  }
  
  /**
   * 找到合适的脚本插入位置
   */
  findInsertPosition(html, libraryName) {
    const config = getLibraryConfig(libraryName);
    
    // 如果有依赖，在依赖之后插入
    if (config && config.requires && config.requires.length > 0) {
      for (const dep of config.requires) {
        const depConfig = getLibraryConfig(dep);
        if (depConfig && depConfig.patterns) {
          for (const pattern of depConfig.patterns) {
            // 找到依赖库的 script 标签
            const regex = new RegExp(`<script[^>]*${this.escapeRegex(pattern)}[^>]*><\\/script>`, 'i');
            const match = html.match(regex);
            if (match) {
              return {
                type: 'after-script',
                target: match[0]
              };
            }
          }
        }
      }
    }
    
    return { type: 'head' };
  }
  
  /**
   * 移除重复的库引用
   */
  removeDuplicateLibraries(html, changes) {
    // 找出所有 script 标签及其位置
    const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
    const scripts = [];
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      scripts.push({
        full: match[0],
        src: match[1],
        index: match.index,
        length: match[0].length
      });
    }
    
    // 按文件名分组，检测重复
    const fileNameGroups = new Map(); // fileName -> [scripts]
    for (const script of scripts) {
      const fileName = script.src.split('/').pop()?.split('?')[0];
      if (!fileName) continue;
      
      // 忽略 auto-render 等附加库
      if (fileName === 'auto-render.min.js') continue;
      
      if (!fileNameGroups.has(fileName)) {
        fileNameGroups.set(fileName, []);
      }
      fileNameGroups.get(fileName).push(script);
    }
    
    // 找出需要移除的重复项（保留第一个，移除后面的）
    const toRemove = [];
    for (const [fileName, group] of fileNameGroups) {
      if (group.length > 1) {
        // 保留第一个，标记其他的为需要移除
        for (let i = 1; i < group.length; i++) {
          toRemove.push(group[i]);
        }
      }
    }
    
    if (toRemove.length === 0) {
      return html;
    }
    
    // 按位置倒序排列，从后往前移除，避免位置偏移问题
    toRemove.sort((a, b) => b.index - a.index);
    
    let updatedHtml = html;
    for (const dup of toRemove) {
      // 计算要移除的范围（包括前后的空白和换行）
      let startIndex = dup.index;
      let endIndex = dup.index + dup.length;
      
      // 检查前面是否有空白
      while (startIndex > 0 && (updatedHtml[startIndex - 1] === ' ' || updatedHtml[startIndex - 1] === '\t')) {
        startIndex--;
      }
      
      // 检查后面是否有换行
      if (updatedHtml[endIndex] === '\n') {
        endIndex++;
      } else if (updatedHtml[endIndex] === '\r' && updatedHtml[endIndex + 1] === '\n') {
        endIndex += 2;
      }
      
      // 移除
      updatedHtml = updatedHtml.slice(0, startIndex) + updatedHtml.slice(endIndex);
      
      changes.push({
        type: 'delete',
        location: dup.src,
        reason: `移除重复的库引用: ${dup.src.split('/').pop()}`
      });
      
      logger.info(`[LibraryFixer] 移除重复的库: ${dup.src}`);
    }
    
    return updatedHtml;
  }
  
  /**
   * 替换 script 标签并添加 fallback
   */
  replaceScriptsWithFallback(html, changes) {
    const baseUrl = getFallbackBaseUrl();
    
    return html.replace(
      /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
      (match, beforeAttrs, src, afterAttrs) => {
        // 如果已经有 onerror，跳过
        if (/onerror=/i.test(match)) {
          return match;
        }
        
        // 跳过内联脚本和数据 URL
        if (src.startsWith('data:') || src.startsWith('blob:')) {
          return match;
        }
        
        // 查找推荐的 CDN URL
        const replacement = findReplacementUrl(src, 'js');
        let primary = replacement?.url || src;
        let entry = replacement?.entry;
        
        // 获取 fallback
        let fallbackUrl = null;
        if (entry && entry.fallback) {
          fallbackUrl = `${baseUrl}/${entry.fallback}`;
        } else {
          const libraryInfo = extractLibraryInfo(primary);
          if (libraryInfo && libraryInfo.file) {
            fallbackUrl = `${baseUrl}/${libraryInfo.file}`;
          }
        }
        
        if (primary !== src) {
          changes.push({
            type: 'replace',
            location: src,
            before: src,
            after: primary,
            reason: '使用推荐的 CDN URL'
          });
        }
        
        if (fallbackUrl) {
          if (primary === src) {
            changes.push({
              type: 'insert',
              location: src,
              after: `onerror fallback: ${fallbackUrl}`,
              reason: '添加 CDN 回退'
            });
          }
          return `<script${beforeAttrs || ''} src="${primary}" onerror="this.onerror=null; this.src='${fallbackUrl}'"${afterAttrs || ''}></script>`;
        }
        
        if (primary !== src) {
          return `<script${beforeAttrs || ''} src="${primary}"${afterAttrs || ''}></script>`;
        }
        
        return match;
      }
    );
  }
  
  /**
   * 替换 link 标签并添加 fallback（CSS）
   */
  replaceLinksWithFallback(html, changes) {
    const baseUrl = getFallbackBaseUrl();
    
    return html.replace(
      /<link\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
      (match, beforeAttrs, href, afterAttrs) => {
        // 检查是否是 stylesheet
        const relMatch = match.match(/\brel=["']([^"']+)["']/i);
        const rel = relMatch ? relMatch[1].toLowerCase() : '';
        if (rel && rel !== 'stylesheet' && rel !== 'preload' && rel !== 'prefetch') {
          return match;
        }
        
        // 只处理 CSS 文件
        if (!href.endsWith('.css') && !href.includes('.css')) {
          return match;
        }
        
        // 查找推荐的 CDN URL
        const replacement = findReplacementUrl(href, 'css');
        let primary = replacement?.url || href;
        
        if (primary !== href) {
          changes.push({
            type: 'replace',
            location: href,
            before: href,
            after: primary,
            reason: '使用推荐的 CDN URL (CSS)'
          });
          return `<link${beforeAttrs || ''} href="${primary}"${afterAttrs || ''}>`;
        }
        
        return match;
      }
    );
  }
  
  /**
   * 修复脚本顺序问题
   * 只检测并修复明显的依赖顺序错误，避免过于激进的重排序
   */
  fixScriptOrder(html, changes) {
    const libs = getSupportedLibraries();
    if (!libs || !libs.libraries) return html;
    
    // 提取所有 script 标签及其位置
    const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
    const scripts = [];
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const src = match[1];
      let libraryName = null;
      let priority = 50; // 默认中等优先级
      let requires = [];
      
      // 识别这是哪个库
      for (const [key, lib] of Object.entries(libs.libraries)) {
        if (lib.patterns) {
          for (const pattern of lib.patterns) {
            if (src.includes(pattern)) {
              libraryName = key;
              priority = lib.priority || 50;
              requires = lib.requires || [];
              break;
            }
          }
        }
        if (libraryName) break;
      }
      
      scripts.push({
        full: match[0],
        src,
        index: match.index,
        libraryName,
        priority,
        requires
      });
    }
    
    // 检查是否有依赖顺序错误
    // 例如：OrbitControls 出现在 Three.js 之前
    let hasOrderError = false;
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.requires && script.requires.length > 0) {
        // 检查所有依赖是否在当前脚本之前
        for (const dep of script.requires) {
          const depIndex = scripts.findIndex(s => s.libraryName === dep);
          if (depIndex > i) {
            // 依赖在当前脚本之后，需要修复
            hasOrderError = true;
            logger.warn(`[LibraryFixer] 检测到顺序错误: ${script.libraryName} 需要 ${dep}，但 ${dep} 在其之后`);
            break;
          }
        }
      }
      if (hasOrderError) break;
    }
    
    if (!hasOrderError) {
      return html;
    }
    
    // 只有在有明确的依赖错误时才重新排序
    // 使用拓扑排序确保依赖正确
    const sorted = this.topologicalSort(scripts);
    
    if (!sorted) {
      logger.warn('[LibraryFixer] 无法进行拓扑排序，跳过重排序');
      return html;
    }
    
    // 重新排序
    let updatedHtml = html;
    
    // 1. 从 HTML 中移除所有检测到的库 script
    for (const script of scripts) {
      // 移除脚本及其前后的空白
      updatedHtml = updatedHtml.replace(script.full + '\n', '');
      updatedHtml = updatedHtml.replace('\n' + script.full, '');
      updatedHtml = updatedHtml.replace(script.full, '');
    }
    
    // 2. 重新插入（在 </head> 之前）
    const insertPoint = '</head>';
    const orderedScripts = sorted.map(s => '    ' + s.full).join('\n');
    updatedHtml = updatedHtml.replace(insertPoint, orderedScripts + '\n' + insertPoint);
    
    changes.push({
      type: 'reorder',
      reason: '修复库脚本依赖顺序',
      details: sorted.map(s => s.libraryName || s.src.split('/').pop())
    });
    
    logger.info(`[LibraryFixer] 修复了 ${scripts.length} 个库脚本的顺序`);
    
    return updatedHtml;
  }
  
  /**
   * 拓扑排序
   */
  topologicalSort(scripts) {
    // 构建依赖图
    const graph = new Map();
    const inDegree = new Map();
    
    for (const script of scripts) {
      const name = script.libraryName || script.src;
      if (!graph.has(name)) {
        graph.set(name, []);
        inDegree.set(name, 0);
      }
    }
    
    // 添加边
    for (const script of scripts) {
      const name = script.libraryName || script.src;
      for (const dep of script.requires) {
        // 只处理在当前脚本列表中的依赖
        const depScript = scripts.find(s => s.libraryName === dep);
        if (depScript) {
          const depName = depScript.libraryName || depScript.src;
          if (!graph.get(depName).includes(name)) {
            graph.get(depName).push(name);
            inDegree.set(name, (inDegree.get(name) || 0) + 1);
          }
        }
      }
    }
    
    // Kahn's 算法
    const queue = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }
    
    const sortedNames = [];
    while (queue.length > 0) {
      // 从入度为0的节点中选择优先级最高的
      queue.sort((a, b) => {
        const scriptA = scripts.find(s => (s.libraryName || s.src) === a);
        const scriptB = scripts.find(s => (s.libraryName || s.src) === b);
        return (scriptA?.priority || 50) - (scriptB?.priority || 50);
      });
      
      const name = queue.shift();
      sortedNames.push(name);
      
      for (const neighbor of graph.get(name) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    if (sortedNames.length !== scripts.length) {
      // 存在循环依赖
      return null;
    }
    
    // 根据排序后的名称重新排列 scripts
    return sortedNames.map(name => 
      scripts.find(s => (s.libraryName || s.src) === name)
    ).filter(Boolean);
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// 导出辅助函数供外部使用
LibraryFixer.extractLibraryInfo = extractLibraryInfo;
LibraryFixer.findReplacementUrl = findReplacementUrl;
LibraryFixer.generateFallbackUrl = generateFallbackUrl;
LibraryFixer.getSupportedLibraryEntries = getSupportedLibraryEntries;
LibraryFixer.getLibraryConfig = getLibraryConfig;
LibraryFixer.getLibraryUrl = getLibraryUrl;

module.exports = LibraryFixer;
