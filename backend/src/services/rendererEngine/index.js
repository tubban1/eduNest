/**
 * Renderer Engine - 内容渲染与自动修复系统
 * 
 * 负责检测和自动修复 AI 生成内容中的渲染问题
 * 设计理念：检测 → 自动修复 → 验证 → 应用
 */

const RendererEngine = require('./RendererEngine');
const MathChecker = require('./checkers/MathChecker');
const RuntimeChecker = require('./checkers/RuntimeChecker');
const LibraryChecker = require('./checkers/LibraryChecker');
const MathFixer = require('./fixers/MathFixer');
const RuntimeFixer = require('./fixers/RuntimeFixer');
const LibraryFixer = require('./fixers/LibraryFixer');

// 创建默认引擎实例
function createRendererEngine(options = {}) {
  const engine = new RendererEngine(options);
  
  // 注册默认 Checkers（按优先级：库 → 数学 → 运行时）
  engine.registerChecker(new LibraryChecker());  // 优先级 1，最先检测
  engine.registerChecker(new MathChecker());     // 优先级 2
  engine.registerChecker(new RuntimeChecker());  // 优先级 3
  
  // 注册默认 Fixers
  engine.registerFixer(new LibraryFixer());      // 库修复优先
  engine.registerFixer(new MathFixer());
  engine.registerFixer(new RuntimeFixer());
  
  return engine;
}

// 单例实例（用于大多数场景）
let defaultEngine = null;

function getDefaultEngine() {
  if (!defaultEngine) {
    defaultEngine = createRendererEngine();
  }
  return defaultEngine;
}

module.exports = {
  RendererEngine,
  createRendererEngine,
  getDefaultEngine,
  
  // 导出 Checkers 和 Fixers 供自定义使用
  checkers: {
    LibraryChecker,
    MathChecker,
    RuntimeChecker
  },
  fixers: {
    LibraryFixer,
    MathFixer,
    RuntimeFixer
  }
};
