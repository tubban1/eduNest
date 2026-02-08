/**
 * RuntimeChecker - 运行时问题检测器
 * 
 * 检测 AI 生成代码后可能出现的运行时问题：
 * - AUDIO_AUTOPLAY_BLOCKED: 音频自动播放被阻止
 * - THREE_DISPOSE_MISSING: Three.js 资源未释放
 * - GSAP_ANIMATION_LEAK: GSAP 动画未清理
 */

class RuntimeChecker {
  constructor() {
    this.name = 'RuntimeChecker';
    this.priority = 2;
  }
  
  /**
   * 执行检测
   * @param {string} html - HTML 内容
   * @returns {Promise<CheckResult>}
   */
  async check(html) {
    const issues = [];
    const metadata = {
      hasThree: false,
      hasGsap: false,
      hasTone: false,
      hasHowler: false,
      hasP5: false,
      hasPhaser: false
    };
    
    if (!html) {
      return { issues, metadata };
    }
    
    // 检测使用的库
    metadata.hasThree = this.detectThreeJS(html);
    metadata.hasGsap = this.detectGSAP(html);
    metadata.hasTone = this.detectToneJS(html);
    metadata.hasHowler = this.detectHowler(html);
    metadata.hasP5 = this.detectP5(html);
    metadata.hasPhaser = this.detectPhaser(html);
    
    // 1. 音频自动播放检查
    if (metadata.hasTone || metadata.hasHowler) {
      const audioIssues = this.checkAudioAutoplay(html, metadata);
      issues.push(...audioIssues);
    }
    
    // 2. Three.js 资源清理检查
    if (metadata.hasThree) {
      const threeIssues = this.checkThreeJSCleanup(html);
      issues.push(...threeIssues);
    }
    
    // 3. GSAP 动画清理检查
    if (metadata.hasGsap) {
      const gsapIssues = this.checkGSAPCleanup(html);
      issues.push(...gsapIssues);
    }
    
    // 4. Vue ref 使用错误检查
    const vueRefIssues = this.checkVueRefErrors(html);
    issues.push(...vueRefIssues);
    
    // 5. Vue setInterval 在阶段切换时未停止检查
    const vueIntervalIssues = this.checkVueIntervalIssues(html);
    issues.push(...vueIntervalIssues);
    
    // 6. 重复赋值检查
    const duplicateAssignmentIssues = this.checkDuplicateAssignments(html);
    issues.push(...duplicateAssignmentIssues);
    
    // 7. Vue ref 在 v-for 内 + Three.js/Canvas 容器（ref 为数组导致 3D 不渲染）
    if (metadata.hasThree || /getContext\s*\(\s*['"]2d['"]|getContext\s*\(\s*['"]webgl/i.test(html)) {
      const vueRefVforIssues = this.checkVueRefInVforForThree(html);
      issues.push(...vueRefVforIssues);
    }
    
    return { issues, metadata };
  }
  
  /**
   * 检测 Three.js
   */
  detectThreeJS(html) {
    const patterns = [
      /three\.min\.js/i,
      /three\.js/i,
      /THREE\./,
      /new\s+THREE\./
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 GSAP
   */
  detectGSAP(html) {
    const patterns = [
      /gsap\.min\.js/i,
      /gsap\./i,
      /gsap\.to\(/,
      /gsap\.from\(/,
      /gsap\.timeline\(/
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 Tone.js
   */
  detectToneJS(html) {
    const patterns = [
      /Tone\.min\.js/i,
      /Tone\./,
      /new\s+Tone\./
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 Howler.js
   */
  detectHowler(html) {
    const patterns = [
      /howler\.min\.js/i,
      /Howler\./,
      /new\s+Howl\(/
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 p5.js
   */
  detectP5(html) {
    const patterns = [
      /p5\.min\.js/i,
      /function\s+setup\s*\(\)/,
      /function\s+draw\s*\(\)/,
      /createCanvas\s*\(/
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检测 Phaser
   */
  detectPhaser(html) {
    const patterns = [
      /phaser\.min\.js/i,
      /Phaser\./,
      /new\s+Phaser\.Game\(/
    ];
    return patterns.some(p => p.test(html));
  }
  
  /**
   * 检查音频自动播放问题
   */
  checkAudioAutoplay(html, metadata) {
    const issues = [];
    
    // 检查是否有用户交互处理
    const hasUserInteractionHandler = this.checkAudioInteractionHandler(html);
    
    if (!hasUserInteractionHandler) {
      const audioLib = metadata.hasTone ? 'Tone.js' : 'Howler.js';
      issues.push({
        type: 'audio',
        code: 'AUDIO_AUTOPLAY_BLOCKED',
        severity: 'medium',
        message: `使用了 ${audioLib}，但未检测到用户交互处理，音频可能因浏览器自动播放策略被阻止`,
        fixable: true,
        fixStrategy: 'INJECT_AUDIO_HANDLER'
      });
    }
    
    return issues;
  }
  
  /**
   * 检查是否有音频用户交互处理
   */
  checkAudioInteractionHandler(html) {
    // 好的模式
    const goodPatterns = [
      /Tone\.start\s*\(\)/,
      /await\s+Tone\.start\(/,
      /Howler\.ctx\.resume\(/,
      /audioContext\.resume\(/,
      /click.*Tone\.start/i,
      /touchstart.*Tone\.start/i,
      /AudioAutoplayHandler/i,
      /resumeAudioContext/i
    ];
    
    return goodPatterns.some(p => p.test(html));
  }
  
  /**
   * 检查 Three.js 资源清理
   */
  checkThreeJSCleanup(html) {
    const issues = [];
    
    // 检查是否有 dispose 调用
    const hasDispose = /\.dispose\s*\(\)/.test(html);
    
    // 检查是否有生命周期清理
    const hasLifecycleCleanup = 
      /onUnmounted\s*\(/.test(html) ||
      /beforeUnmount\s*\(/.test(html) ||
      /beforeunload/.test(html) ||
      /ThreeJSCleanup/.test(html);
    
    if (!hasDispose || !hasLifecycleCleanup) {
      issues.push({
        type: 'memory',
        code: 'THREE_DISPOSE_MISSING',
        severity: 'medium',
        message: 'Three.js 项目未检测到资源清理代码，可能导致内存泄漏',
        fixable: true,
        fixStrategy: 'INJECT_THREE_CLEANUP',
        context: {
          hasDispose,
          hasLifecycleCleanup
        }
      });
    }
    
    return issues;
  }
  
  /**
   * 检查 GSAP 动画清理
   */
  checkGSAPCleanup(html) {
    const issues = [];
    
    // 检查是否有 kill 调用
    const hasKill = 
      /gsap\.killTweensOf\s*\(/.test(html) ||
      /gsap\.killAll\s*\(/.test(html) ||
      /\.kill\s*\(\)/.test(html);
    
    // 检查是否有生命周期清理
    const hasLifecycleCleanup = 
      /onUnmounted.*gsap/is.test(html) ||
      /beforeUnmount.*gsap/is.test(html) ||
      /beforeunload.*gsap/is.test(html);
    
    if (!hasKill && !hasLifecycleCleanup) {
      issues.push({
        type: 'memory',
        code: 'GSAP_ANIMATION_LEAK',
        severity: 'low',
        message: 'GSAP 动画未检测到清理代码，页面切换时可能导致动画残留',
        fixable: true,
        fixStrategy: 'INJECT_GSAP_CLEANUP'
      });
    }
    
    return issues;
  }
  
  /**
   * 检查 Vue ref 使用错误
   * 例如：hasMutated.ref = true; 应该是 hasMutated.value = true;
   */
  checkVueRefErrors(html) {
    const issues = [];
    
    // 检测 Vue 3 的 ref 使用错误
    // 模式：refName.ref = 或 refName.ref =
    const refErrorPattern = /(\w+)\.ref\s*=/g;
    const matches = [];
    let match;
    
    while ((match = refErrorPattern.exec(html)) !== null) {
      const refName = match[1];
      // 检查是否是 Vue ref（通常是通过 ref() 创建的）
      const isRef = new RegExp(`(const|let|var)\\s+${refName}\\s*=\\s*ref\\(`, 'i').test(html);
      
      if (isRef) {
        matches.push({
          refName,
          position: match.index,
          fullMatch: match[0]
        });
      }
    }
    
    if (matches.length > 0) {
      issues.push({
        type: 'runtime',
        code: 'VUE_REF_ERROR',
        severity: 'high',
        message: `检测到 ${matches.length} 处 Vue ref 使用错误（使用了 .ref 而不是 .value）`,
        fixable: true,
        fixStrategy: 'FIX_VUE_REF_ERROR',
        context: {
          matches: matches.slice(0, 10) // 只保存前10个
        }
      });
    }
    
    return issues;
  }
  
  /**
   * 检查 Vue setInterval 在阶段切换时未停止的问题
   * 例如：startProliferation 函数中使用了 setInterval，但没有在阶段切换时停止
   */
  checkVueIntervalIssues(html) {
    const issues = [];
    
    // 检测包含 setInterval 的函数，且该函数在 Vue 组件中（有 currentStage）
    const hasCurrentStage = /currentStage/.test(html);
    const hasSetInterval = /setInterval/.test(html);
    
    if (hasCurrentStage && hasSetInterval) {
      // 匹配函数定义，支持多行函数体
      const functionPattern = /(const|let|function)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?setInterval[\s\S]*?)\}/g;
      let match;
      
      while ((match = functionPattern.exec(html)) !== null) {
        const funcName = match[2];
        const funcBody = match[3];
        
        // 检查 setInterval 回调中是否有 currentStage 检查
        // 匹配 setInterval(() => { ... }, delay) 中的回调体
        const intervalCallbackPattern = /setInterval\s*\(\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*[^)]+\)/;
        const callbackMatch = funcBody.match(intervalCallbackPattern);
        
        if (callbackMatch) {
          const callbackBody = callbackMatch[1];
          
          // 检查回调体中是否有 currentStage 检查
          const hasStageCheck = /currentStage\.value\s*[!=]==?\s*\d+/.test(callbackBody) || 
                               /if\s*\(\s*currentStage/.test(callbackBody);
          
          // 检查是否有 clearInterval（但可能只是用于 count 检查，不是阶段检查）
          const hasClearInterval = /clearInterval/.test(callbackBody);
          
          // 如果回调体中有数组 push 操作（如 tumorCells.value.push），但没有阶段检查，则有问题
          const hasArrayPush = /\.value\.push\s*\(/.test(callbackBody);
          
          if (hasArrayPush && !hasStageCheck) {
            issues.push({
              type: 'runtime',
              code: 'VUE_INTERVAL_NOT_STOPPED',
              severity: 'high',
              message: `检测到 ${funcName} 函数中使用了 setInterval 更新数组，但没有在阶段切换时停止，可能导致 DOM 更新错误`,
              fixable: true,
              fixStrategy: 'FIX_VUE_INTERVAL',
              context: {
                functionName: funcName,
                position: match.index
              }
            });
          }
        }
      }
    }
    
    return issues;
  }
  
  /**
   * 检查 Vue ref 在 v-for 内用于 Three.js/Canvas 容器：Vue 3 会收集为数组，直接用 .value 导致 3D 不渲染
   */
  checkVueRefInVforForThree(html) {
    const issues = [];
    if (!/v-for\s*=/.test(html)) return issues;
    // 查找阶段索引变量名（常见命名），未检测到则不修复，避免误伤
    const stageIndexVars = ['currentStageIndex', 'stageIndex', 'currentStep', 'stepIndex', 'pageIndex', 'currentPage'];
    const stageIndexVar = stageIndexVars.find(name => new RegExp(`\\b${name}\\b`).test(html));
    if (!stageIndexVar) return issues;
    // 查找 ref="xxx" 且用于 DOM 操作的容器名
    const refMatch = html.match(/ref\s*=\s*["'](\w+)["']/);
    if (!refMatch) return issues;
    const refName = refMatch[1];
    // 检查是否有 initThree/initCanvas 等函数直接使用 refName.value 做 clientWidth/appendChild，且没有 Array.isArray 解析
    const hasDirectUse = new RegExp(`${refName}\\.value\\.(clientWidth|clientHeight|appendChild)`, 'i').test(html);
    const hasArrayCheck = new RegExp(`Array\\.isArray\\s*\\(\\s*${refName}\\.value\\s*\\)`, 'i').test(html);
    if (hasDirectUse && !hasArrayCheck) {
      issues.push({
        type: 'runtime',
        code: 'VUE_REF_IN_VFOR_THREE',
        severity: 'high',
        message: 'Vue 3 中 ref 在 v-for 内会变成数组，Three.js/Canvas 容器需取阶段索引对应元素',
        fixable: true,
        fixStrategy: 'FIX_VUE_REF_IN_VFOR_THREE',
        context: { refName, stageIndexVar }
      });
    }
    return issues;
  }

  /**
   * 检查重复赋值问题
   * 例如：hasMutated.value = true; hasMutated.value = true;
   */
  checkDuplicateAssignments(html) {
    const issues = [];
    
    // 检测连续相同的赋值语句（支持多行）
    // 匹配模式：varName.value = value; 后跟相同的赋值
    const duplicatePattern = /((\w+\.(value|ref)\s*=\s*[^;]+;)\s*\n\s*\2)/g;
    let match;
    
    while ((match = duplicatePattern.exec(html)) !== null) {
      const fullMatch = match[1];
      const assignment = match[2];
      const varName = match[3];
      
      issues.push({
        type: 'runtime',
        code: 'DUPLICATE_ASSIGNMENT',
        severity: 'low',
        message: `检测到重复赋值：${assignment}`,
        fixable: true,
        fixStrategy: 'REMOVE_DUPLICATE_ASSIGNMENT',
        context: {
          assignment: assignment,
          fullMatch: fullMatch,
          position: match.index
        }
      });
    }
    
    return issues;
  }
}

module.exports = RuntimeChecker;
