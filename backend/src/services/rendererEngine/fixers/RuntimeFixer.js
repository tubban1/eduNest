/**
 * RuntimeFixer - 运行时问题修复器
 * 
 * 处理的问题：
 * - AUDIO_AUTOPLAY_BLOCKED: 注入音频用户交互处理
 * - THREE_DISPOSE_MISSING: 注入 Three.js 资源清理
 * - GSAP_ANIMATION_LEAK: 注入 GSAP 动画清理
 */

class RuntimeFixer {
  constructor() {
    this.name = 'RuntimeFixer';
    this.handles = [
      'AUDIO_AUTOPLAY_BLOCKED',
      'THREE_DISPOSE_MISSING',
      'GSAP_ANIMATION_LEAK',
      'VUE_REF_ERROR',
      'VUE_INTERVAL_NOT_STOPPED',
      'DUPLICATE_ASSIGNMENT'
    ];
  }
  
  /**
   * 检查是否能修复这个问题
   */
  canFix(issue) {
    return this.handles.includes(issue.code);
  }
  
  /**
   * 执行修复
   */
  async fix(html, issue, context = {}) {
    switch (issue.code) {
      case 'AUDIO_AUTOPLAY_BLOCKED':
        return this.injectAudioHandler(html);
        
      case 'THREE_DISPOSE_MISSING':
        return this.injectThreeCleanup(html);
        
      case 'GSAP_ANIMATION_LEAK':
        return this.injectGsapCleanup(html);
        
      case 'VUE_REF_ERROR':
        return this.fixVueRefError(html, issue);
        
      case 'VUE_INTERVAL_NOT_STOPPED':
        return this.fixVueInterval(html, issue);
        
      case 'DUPLICATE_ASSIGNMENT':
        return this.fixDuplicateAssignment(html, issue);
        
      default:
        return { success: false, html, changes: [], explanation: '未知的问题类型' };
    }
  }
  
  /**
   * 注入音频用户交互处理
   */
  injectAudioHandler(html) {
    const changes = [];
    let fixedHtml = html;
    
    // 检查是否已经有音频处理
    if (html.includes('AudioAutoplayHandler') || html.includes('Tone.start()')) {
      return {
        success: true,
        html: fixedHtml,
        changes: [],
        explanation: '音频处理器已存在'
      };
    }
    
    const audioHandler = `
<script>
// Audio Autoplay Handler - 处理浏览器自动播放限制
(function() {
  var resumed = false;
  
  var resume = function() {
    if (resumed) return;
    
    // Tone.js
    if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
      Tone.start().then(function() {
        console.log('[AudioAutoplayHandler] Tone.js audio context resumed');
      }).catch(function(e) {
        console.warn('[AudioAutoplayHandler] Failed to resume Tone.js:', e);
      });
    }
    
    // Howler.js
    if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume().then(function() {
        console.log('[AudioAutoplayHandler] Howler.js audio context resumed');
      }).catch(function(e) {
        console.warn('[AudioAutoplayHandler] Failed to resume Howler.js:', e);
      });
    }
    
    // 通用 Web Audio API
    if (window.audioContext && window.audioContext.state !== 'running') {
      window.audioContext.resume();
    }
    
    resumed = true;
  };
  
  // 监听用户交互事件
  ['click', 'touchstart', 'keydown'].forEach(function(eventType) {
    document.addEventListener(eventType, resume, { once: true });
  });
  
  console.log('[AudioAutoplayHandler] Initialized - waiting for user interaction');
})();
</script>`;
    
    // 插入到 </body> 前
    if (fixedHtml.includes('</body>')) {
      fixedHtml = fixedHtml.replace('</body>', `${audioHandler}\n</body>`);
    } else {
      fixedHtml += audioHandler;
    }
    
    changes.push({
      type: 'insert',
      location: '</body>',
      after: 'AudioAutoplayHandler',
      reason: '注入音频自动播放处理，监听用户交互以恢复音频上下文'
    });
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: '注入用户交互监听，解决浏览器音频自动播放限制'
    };
  }
  
  /**
   * 注入 Three.js 资源清理
   */
  injectThreeCleanup(html) {
    const changes = [];
    let fixedHtml = html;
    
    // 检查是否已经有清理代码
    if (html.includes('ThreeJSCleanup') || html.includes('WEBGL_lose_context')) {
      return {
        success: true,
        html: fixedHtml,
        changes: [],
        explanation: 'Three.js 清理代码已存在'
      };
    }
    
    const cleanup = `
<script>
// Three.js Auto Cleanup - 页面卸载时释放 WebGL 资源
(function() {
  var cleanupExecuted = false;
  
  var cleanup = function() {
    if (cleanupExecuted) return;
    cleanupExecuted = true;
    
    // 释放所有 Canvas 的 WebGL 上下文
    document.querySelectorAll('canvas').forEach(function(canvas) {
      try {
        var gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl) {
          var ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        }
      } catch (e) {
        // 忽略错误
      }
    });
    
    // 如果有全局 renderer，尝试释放
    if (window.renderer && typeof window.renderer.dispose === 'function') {
      try {
        window.renderer.dispose();
      } catch (e) {
        // 忽略错误
      }
    }
    
    console.log('[ThreeJSCleanup] WebGL resources released');
  };
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);
  
  // 页面隐藏时也尝试清理（移动端）
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      cleanup();
    }
  });
  
  console.log('[ThreeJSCleanup] Initialized');
})();
</script>`;
    
    // 插入到 </body> 前
    if (fixedHtml.includes('</body>')) {
      fixedHtml = fixedHtml.replace('</body>', `${cleanup}\n</body>`);
    } else {
      fixedHtml += cleanup;
    }
    
    changes.push({
      type: 'insert',
      location: '</body>',
      after: 'ThreeJSCleanup',
      reason: '注入页面卸载时的 WebGL 资源释放'
    });
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: '注入页面卸载时的 WebGL 资源释放，防止内存泄漏'
    };
  }
  
  /**
   * 注入 GSAP 动画清理
   */
  injectGsapCleanup(html) {
    const changes = [];
    let fixedHtml = html;
    
    // 检查是否已经有清理代码
    if (html.includes('GSAPCleanup') || html.includes('gsap.killTweensOf')) {
      return {
        success: true,
        html: fixedHtml,
        changes: [],
        explanation: 'GSAP 清理代码已存在'
      };
    }
    
    const cleanup = `
<script>
// GSAP Auto Cleanup - 页面卸载时清理动画
(function() {
  window.addEventListener('beforeunload', function() {
    if (typeof gsap !== 'undefined') {
      try {
        gsap.killTweensOf('*');
        console.log('[GSAPCleanup] All GSAP tweens killed');
      } catch (e) {
        // 忽略错误
      }
    }
  });
  
  console.log('[GSAPCleanup] Initialized');
})();
</script>`;
    
    // 插入到 </body> 前
    if (fixedHtml.includes('</body>')) {
      fixedHtml = fixedHtml.replace('</body>', `${cleanup}\n</body>`);
    } else {
      fixedHtml += cleanup;
    }
    
    changes.push({
      type: 'insert',
      location: '</body>',
      after: 'GSAPCleanup',
      reason: '注入页面卸载时的 GSAP 动画清理'
    });
    
    return {
      success: true,
      html: fixedHtml,
      changes,
      explanation: '注入页面卸载时的 GSAP 动画清理'
    };
  }
  
  /**
   * 修复 Vue ref 使用错误
   * 将 .ref = 替换为 .value =
   */
  fixVueRefError(html, issue) {
    const changes = [];
    let fixedHtml = html;
    
    // 获取所有匹配的 ref 名称
    const matches = issue.context?.matches || [];
    
    // 对每个 ref 名称，替换 .ref = 为 .value =
    for (const match of matches) {
      const refName = match.refName;
      // 使用单词边界确保只匹配完整的 ref 名称
      const pattern = new RegExp(`\\b${refName}\\.ref\\s*=`, 'g');
      
      if (pattern.test(fixedHtml)) {
        const before = fixedHtml;
        fixedHtml = fixedHtml.replace(pattern, `${refName}.value =`);
        
        if (before !== fixedHtml) {
          changes.push({
            type: 'replace',
            location: `${refName} ref usage`,
            before: `${refName}.ref =`,
            after: `${refName}.value =`,
            reason: `修复 Vue ref 使用错误：将 ${refName}.ref 替换为 ${refName}.value`
          });
        }
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? `修复了 ${changes.length} 处 Vue ref 使用错误`
        : '未检测到需要修复的 Vue ref 错误'
    };
  }
  
  /**
   * 修复 Vue setInterval 在阶段切换时未停止的问题
   */
  fixVueInterval(html, issue) {
    const changes = [];
    let fixedHtml = html;
    const funcName = issue.context?.functionName;
    
    if (!funcName) {
      return { success: false, html: fixedHtml, changes: [], explanation: '无法确定函数名' };
    }
    
    // 查找函数定义，使用更宽松的模式匹配多行函数体
    const funcPattern = new RegExp(`(const|let|function)\\s+${funcName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}`, 'g');
    let match;
    
    while ((match = funcPattern.exec(html)) !== null) {
      const funcBody = match[2];
      const fullMatch = match[0];
      
      // 查找 setInterval 调用
      const intervalPattern = /(const\s+interval\s*=\s*)?setInterval\s*\(\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*([^)]+)\)/;
      const intervalMatch = funcBody.match(intervalPattern);
      
      if (intervalMatch) {
        const callbackBody = intervalMatch[2];
        
        // 检查回调体中是否已经有阶段检查
        if (!/currentStage\.value\s*[!=]==?\s*\d+/.test(callbackBody)) {
          const hasConstInterval = intervalMatch[1];
          const delay = intervalMatch[3];
          
          // 在回调开头添加阶段检查（在 count 检查之前）
          // 找到第一个 if 语句的位置，在其之前插入阶段检查
          const firstIfIndex = callbackBody.search(/\s*if\s*\(/);
          
          let stageCheck;
          if (firstIfIndex > 0) {
            // 在第一个 if 之前插入
            stageCheck = `if (currentStage.value !== 2) {
                            clearInterval(interval);
                            isProliferating.value = false;
                            return;
                        }
                        `;
            const newCallbackBody = callbackBody.slice(0, firstIfIndex) + stageCheck + callbackBody.slice(firstIfIndex);
            const newIntervalCall = `${hasConstInterval || 'const interval = '}setInterval(() => {${newCallbackBody}}, ${delay})`;
            const newFuncBody = funcBody.replace(intervalPattern, newIntervalCall);
            const newFullMatch = fullMatch.replace(funcBody, newFuncBody);
            
            fixedHtml = fixedHtml.replace(fullMatch, newFullMatch);
          } else {
            // 如果没有 if，直接在开头插入
            stageCheck = `if (currentStage.value !== 2) {
                            clearInterval(interval);
                            isProliferating.value = false;
                            return;
                        }
                        `;
            const newCallbackBody = stageCheck + callbackBody;
            const newIntervalCall = `${hasConstInterval || 'const interval = '}setInterval(() => {${newCallbackBody}}, ${delay})`;
            const newFuncBody = funcBody.replace(intervalPattern, newIntervalCall);
            const newFullMatch = fullMatch.replace(funcBody, newFuncBody);
            
            fixedHtml = fixedHtml.replace(fullMatch, newFullMatch);
          }
          
          changes.push({
            type: 'replace',
            location: `${funcName} function`,
            before: 'setInterval without stage check',
            after: 'setInterval with stage check',
            reason: `在 ${funcName} 函数中添加阶段检查，确保在阶段切换时停止 setInterval`
          });
          
          // 只修复第一个匹配
          break;
        }
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? `修复了 ${funcName} 函数中的 setInterval 问题`
        : '未检测到需要修复的 setInterval 问题'
    };
  }
  
  /**
   * 修复重复赋值问题
   */
  fixDuplicateAssignment(html, issue) {
    const changes = [];
    let fixedHtml = html;
    const fullMatch = issue.context?.fullMatch;
    const assignment = issue.context?.assignment;
    
    if (!fullMatch || !assignment) {
      return { success: false, html: fixedHtml, changes: [], explanation: '无法确定重复赋值语句' };
    }
    
    // 直接使用字符串替换，避免正则表达式转义问题
    // fullMatch 格式：assignment + '\n' + whitespace + assignment
    // 我们要保留第一个，移除第二个
    const before = fixedHtml;
    
    // 首先尝试直接使用 fullMatch 进行替换
    if (fixedHtml.includes(fullMatch)) {
      // 直接替换 fullMatch 为单个 assignment
      fixedHtml = fixedHtml.replace(fullMatch, assignment);
      
      if (before !== fixedHtml) {
        changes.push({
          type: 'replace',
          location: 'duplicate assignment',
          before: fullMatch,
          after: assignment,
          reason: '移除重复的赋值语句'
        });
      }
    } else {
      // 如果 fullMatch 不匹配，尝试查找第一个和第二个匹配
      const firstIndex = fixedHtml.indexOf(assignment);
      if (firstIndex !== -1) {
        // 查找第二个匹配的位置（在第一个之后）
        const secondIndex = fixedHtml.indexOf(assignment, firstIndex + assignment.length);
        if (secondIndex !== -1) {
          // 检查第二个匹配之前是否有换行符和空白字符
          const beforeSecond = fixedHtml.substring(firstIndex + assignment.length, secondIndex);
          // 匹配换行符和空白字符（包括制表符和空格）
          if (/^\s*\n\s*$/.test(beforeSecond) || /^\s+$/.test(beforeSecond)) {
            // 移除第二个赋值语句及其前面的换行和空白
            fixedHtml = fixedHtml.substring(0, firstIndex + assignment.length) + 
                        fixedHtml.substring(secondIndex + assignment.length);
            
            if (before !== fixedHtml) {
              changes.push({
                type: 'replace',
                location: 'duplicate assignment',
                before: fullMatch,
                after: assignment,
                reason: '移除重复的赋值语句'
              });
            }
          }
        }
      }
    }
    
    return {
      success: changes.length > 0,
      html: fixedHtml,
      changes,
      explanation: changes.length > 0 
        ? '移除了重复的赋值语句'
        : '未检测到需要修复的重复赋值'
    };
  }
}

module.exports = RuntimeFixer;
