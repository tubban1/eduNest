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
}

module.exports = RuntimeChecker;
