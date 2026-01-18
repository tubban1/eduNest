/**
 * LibraryChecker - 库引用检测器
 * 
 * 检测：
 * - 缺失的依赖库（如使用 THREE.OrbitControls 但未加载 OrbitControls.js）
 * - 重复的库引用
 * - 缺少 fallback 的库引用
 * - 脚本顺序问题
 */

const path = require('path');
const fs = require('fs');
const logger = require('../../../utils/logger');

// 缓存
let supportedLibrariesCache = null;

/**
 * 加载 supported-libraries.json
 */
const getSupportedLibraries = () => {
  if (!supportedLibrariesCache) {
    try {
      const configPath = path.join(__dirname, '../../../../config/supported-libraries.json');
      const content = fs.readFileSync(configPath, 'utf8');
      supportedLibrariesCache = JSON.parse(content);
    } catch (error) {
      logger.warn(`[LibraryChecker] Failed to load config: ${error.message}`);
      supportedLibrariesCache = { libraries: {} };
    }
  }
  return supportedLibrariesCache;
};

class LibraryChecker {
  constructor() {
    this.name = 'LibraryChecker';
    this.priority = 1; // 最先执行
  }
  
  /**
   * 检测库相关问题
   */
  async check(html) {
    if (!html || typeof html !== 'string') {
      return { issues: [], metadata: {} };
    }
    
    const issues = [];
    const libs = getSupportedLibraries();
    
    // 1. 分析已加载的库
    const loadedLibraries = this.analyzeLoadedLibraries(html, libs);
    
    // 2. 提取脚本内容用于检测库使用
    const scriptContent = this.extractScriptContent(html);
    
    // 3. 检测缺失的依赖库
    const missingDeps = this.detectMissingDependencies(html, scriptContent, loadedLibraries, libs);
    for (const dep of missingDeps) {
      issues.push({
        type: 'library',
        code: 'MISSING_DEPENDENCY',
        severity: 'high',
        message: `缺失依赖库: ${dep.name} (${dep.reason})`,
        fixable: true,
        fixStrategy: 'INJECT_LIBRARY',
        context: { libraryName: dep.name, reason: dep.reason }
      });
    }
    
    // 4. 检测重复的库引用
    const duplicates = this.detectDuplicateLibraries(html);
    for (const dup of duplicates) {
      issues.push({
        type: 'library',
        code: 'DUPLICATE_LIBRARY',
        severity: 'medium',
        message: `重复的库引用: ${dup.fileName}`,
        fixable: true,
        fixStrategy: 'REMOVE_DUPLICATE',
        context: { src: dup.src, count: dup.count }
      });
    }
    
    // 5. 检测缺少 fallback 的库
    const noFallback = this.detectMissingFallback(html);
    if (noFallback.length > 0) {
      issues.push({
        type: 'library',
        code: 'MISSING_FALLBACK',
        severity: 'low',
        message: `${noFallback.length} 个库引用缺少 fallback`,
        fixable: true,
        fixStrategy: 'ADD_FALLBACK',
        context: { scripts: noFallback }
      });
    }
    
    return {
      issues,
      metadata: {
        loadedLibraries: Array.from(loadedLibraries),
        totalScripts: this.countScripts(html)
      }
    };
  }
  
  /**
   * 分析已加载的库
   */
  analyzeLoadedLibraries(html, libs) {
    const loaded = new Set();
    
    if (!libs || !libs.libraries) return loaded;
    
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
   * 提取脚本内容
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
   * 检测缺失的依赖库
   */
  detectMissingDependencies(html, scriptContent, loadedLibraries, libs) {
    const missing = [];
    
    if (!libs || !libs.libraries) return missing;
    
    for (const [key, lib] of Object.entries(libs.libraries)) {
      // 如果已加载，检查其依赖
      if (loadedLibraries.has(key)) {
        if (lib.requires) {
          for (const dep of lib.requires) {
            if (!loadedLibraries.has(dep) && !missing.find(m => m.name === dep)) {
              missing.push({
                name: dep,
                reason: `${key} 依赖 ${dep}`
              });
            }
          }
        }
        continue;
      }
      
      // 检测代码中是否使用了该库
      if (lib.detect) {
        for (const pattern of lib.detect) {
          if (scriptContent.includes(pattern) || html.includes(pattern)) {
            missing.push({
              name: key,
              reason: `代码中检测到 ${pattern}`
            });
            
            // 同时检查其依赖
            if (lib.requires) {
              for (const dep of lib.requires) {
                if (!loadedLibraries.has(dep) && !missing.find(m => m.name === dep)) {
                  missing.push({
                    name: dep,
                    reason: `${key} 依赖 ${dep}`
                  });
                }
              }
            }
            break;
          }
        }
      }
    }
    
    // 去重
    const seen = new Set();
    return missing.filter(m => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  }
  
  /**
   * 检测重复的库引用
   */
  detectDuplicateLibraries(html) {
    const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
    const fileNameCount = new Map();
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const src = match[1];
      const fileName = src.split('/').pop()?.split('?')[0];
      if (!fileName) continue;
      
      // 忽略 auto-render 等附加库
      if (fileName === 'auto-render.min.js') continue;
      
      if (!fileNameCount.has(fileName)) {
        fileNameCount.set(fileName, { src, count: 0 });
      }
      fileNameCount.get(fileName).count++;
    }
    
    // 返回重复的（count > 1）
    const duplicates = [];
    for (const [fileName, info] of fileNameCount) {
      if (info.count > 1) {
        duplicates.push({ fileName, src: info.src, count: info.count });
      }
    }
    
    return duplicates;
  }
  
  /**
   * 检测缺少 fallback 的库
   */
  detectMissingFallback(html) {
    const scriptPattern = /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi;
    const noFallback = [];
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const fullTag = match[0];
      const src = match[2];
      
      // 跳过内联脚本、data URL 等
      if (src.startsWith('data:') || src.startsWith('blob:')) continue;
      
      // 检查是否已有 onerror
      if (/onerror=/i.test(fullTag)) continue;
      
      // 只检查 CDN URL
      if (src.includes('cdn.') || src.includes('jsdelivr') || src.includes('unpkg')) {
        noFallback.push(src);
      }
    }
    
    return noFallback;
  }
  
  /**
   * 统计脚本数量
   */
  countScripts(html) {
    const matches = html.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi);
    return matches ? matches.length : 0;
  }
}

module.exports = LibraryChecker;
