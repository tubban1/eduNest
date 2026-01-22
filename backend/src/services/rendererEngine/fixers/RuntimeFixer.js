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
      'VUE_REF_ERROR'
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
}

module.exports = RuntimeFixer;
