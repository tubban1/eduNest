/**
 * RendererEngine - 核心引擎类
 * 
 * 主流程：检测 → 自动修复 → 验证 → 应用
 */

const logger = require('../../utils/logger');

class RendererEngine {
  constructor(options = {}) {
    this.version = '2.0.0';
    this.options = {
      autoFix: true,
      maxFixAttempts: 3,
      ...options
    };
    
    this.checkers = [];
    this.fixers = [];
  }
  
  /**
   * 注册 Checker
   */
  registerChecker(checker) {
    this.checkers.push(checker);
    // 按优先级排序（数字越小优先级越高）
    this.checkers.sort((a, b) => (a.priority || 10) - (b.priority || 10));
  }
  
  /**
   * 注册 Fixer
   */
  registerFixer(fixer) {
    this.fixers.push(fixer);
  }
  
  /**
   * 主处理流程
   * @param {string} html - 原始 HTML
   * @param {object} options - 处理选项
   * @returns {Promise<RenderResult>}
   */
  async process(html, options = {}) {
    const startTime = Date.now();
    const mergedOptions = { ...this.options, ...options };
    
    logger.info('[RendererEngine] 开始处理', {
      htmlLength: html?.length || 0,
      options: mergedOptions
    });
    
    try {
      // 1. 检测阶段
      const checkResults = await this.runCheckers(html, mergedOptions);
      
      // 2. 如果没有问题，直接返回
      if (checkResults.issues.length === 0) {
        logger.info('[RendererEngine] 检测通过，无需修复');
        return this.createResult(html, checkResults, [], Date.now() - startTime);
      }
      
      // 3. 自动修复阶段
      let fixedHtml = html;
      const appliedFixes = [];
      
      if (mergedOptions.autoFix) {
        const fixResult = await this.runFixers(fixedHtml, checkResults, mergedOptions);
        fixedHtml = fixResult.html;
        appliedFixes.push(...fixResult.fixes);
      }
      
      // 4. 验证阶段（重新检测修复后的 HTML）
      const verifyResults = await this.runCheckers(fixedHtml, mergedOptions);
      
      // 5. 生成报告
      const result = this.createResult(
        fixedHtml,
        checkResults,
        appliedFixes,
        Date.now() - startTime,
        verifyResults
      );
      
      logger.info('[RendererEngine] 处理完成', {
        issuesDetected: checkResults.issues.length,
        issuesFixed: appliedFixes.length,
        issuesRemaining: verifyResults.issues.length,
        duration: result.duration
      });
      
      return result;
      
    } catch (error) {
      logger.error('[RendererEngine] 处理失败', { error: error.message });
      return {
        success: false,
        html: html,
        report: null,
        fixes: [],
        unfixedIssues: [],
        error: error.message
      };
    }
  }
  
  /**
   * 运行所有 Checkers
   */
  async runCheckers(html, options) {
    const allIssues = [];
    const metadata = {};
    
    // 确定要运行的 checkers
    const checkersToRun = options.checkers
      ? this.checkers.filter(c => options.checkers.includes(c.name.toLowerCase().replace('checker', '')))
      : this.checkers;
    
    for (const checker of checkersToRun) {
      try {
        const result = await checker.check(html);
        allIssues.push(...result.issues);
        Object.assign(metadata, result.metadata || {});
      } catch (error) {
        logger.warn(`[RendererEngine] Checker ${checker.name} 执行失败`, { error: error.message });
      }
    }
    
    return { issues: allIssues, metadata };
  }
  
  /**
   * 运行 Fixers 修复问题
   */
  async runFixers(html, checkResults, options) {
    let currentHtml = html;
    const appliedFixes = [];
    
    // 按问题分组，找到对应的 Fixer
    for (const issue of checkResults.issues) {
      if (!issue.fixable) continue;
      
      // 找到能处理这个问题的 Fixer
      const fixer = this.fixers.find(f => f.handles.includes(issue.code));
      
      if (!fixer) {
        logger.debug(`[RendererEngine] 没有找到能处理 ${issue.code} 的 Fixer`);
        continue;
      }
      
      try {
        // 检查 Fixer 是否能修复这个问题
        if (fixer.canFix && !fixer.canFix(issue)) {
          continue;
        }
        
        // 执行修复
        const fixResult = await fixer.fix(currentHtml, issue, {
          metadata: checkResults.metadata,
          options
        });
        
        // 记录所有修复尝试（包括成功和失败的）
        if (fixResult.success) {
          currentHtml = fixResult.html;
          appliedFixes.push({
            issueCode: issue.code,
            fixer: fixer.name,
            strategy: issue.fixStrategy,
            success: true,
            changes: fixResult.changes,
            explanation: fixResult.explanation
          });
          
          logger.debug(`[RendererEngine] 修复成功: ${issue.code}`, {
            fixer: fixer.name,
            explanation: fixResult.explanation
          });
        } else {
          // 记录失败的修复尝试
          appliedFixes.push({
            issueCode: issue.code,
            fixer: fixer.name,
            strategy: issue.fixStrategy,
            success: false,
            explanation: fixResult.explanation || '修复返回了 success: false',
            changes: fixResult.changes || []
          });
          
          logger.debug(`[RendererEngine] 修复失败: ${issue.code}`, {
            fixer: fixer.name,
            explanation: fixResult.explanation
          });
        }
      } catch (error) {
        logger.warn(`[RendererEngine] Fixer ${fixer.name} 执行失败`, {
          issue: issue.code,
          error: error.message
        });
        
        appliedFixes.push({
          issueCode: issue.code,
          fixer: fixer.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return { html: currentHtml, fixes: appliedFixes };
  }
  
  /**
   * 创建处理结果
   */
  createResult(html, checkResults, appliedFixes, duration, verifyResults = null) {
    const finalIssues = verifyResults ? verifyResults.issues : checkResults.issues;
    const successfulFixes = appliedFixes.filter(f => f.success);
    
    return {
      success: finalIssues.length === 0,
      html: html,
      report: {
        id: this.generateReportId(),
        engineVersion: this.version,
        createdAt: new Date().toISOString(),
        checks: checkResults,
        fixes: {
          applied: successfulFixes,
          failed: appliedFixes.filter(f => !f.success),
          skipped: []
        },
        summary: {
          status: this.determineStatus(finalIssues),
          issuesDetected: checkResults.issues.length,
          issuesFixed: successfulFixes.length,
          issuesRemaining: finalIssues.length
        }
      },
      fixes: appliedFixes,
      unfixedIssues: finalIssues,
      duration: duration
    };
  }
  
  /**
   * 确定报告状态
   */
  determineStatus(remainingIssues) {
    if (remainingIssues.length === 0) return 'pass';
    
    const hasHighSeverity = remainingIssues.some(i => i.severity === 'high');
    return hasHighSeverity ? 'error' : 'warning';
  }
  
  /**
   * 生成报告 ID
   */
  generateReportId() {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 修复指定的问题（用于手动触发）
   */
  async fixSpecificIssues(html, issueCodes) {
    // 先检测所有问题
    const checkResults = await this.runCheckers(html, {});
    
    // 筛选指定的问题
    const filteredResults = {
      issues: checkResults.issues.filter(i => issueCodes.includes(i.code)),
      metadata: checkResults.metadata
    };
    
    // 运行修复
    const fixResult = await this.runFixers(html, filteredResults, {});
    
    // 重新检测
    const verifyResults = await this.runCheckers(fixResult.html, {});
    
    return this.createResult(fixResult.html, checkResults, fixResult.fixes, 0, verifyResults);
  }
}

module.exports = RendererEngine;
