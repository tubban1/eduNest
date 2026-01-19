#!/usr/bin/env node

/**
 * 通过 content_id 或 short_id 优化 full_html
 * 使用方法: node scripts/optimizeContentHtml.js <content_id|short_id>
 */

require('dotenv').config({ path: '.env.local' });

const { createRendererEngine } = require('../src/services/rendererEngine');
const DatabaseService = require('../src/services/database');

async function optimizeContentHtml(identifier) {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Renderer Engine - Content HTML 优化工具');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📋 标识符: ${identifier}\n`);

    // 1. 从数据库读取 full_html
    // 先尝试作为 content_id 查询，如果失败再尝试作为 short_id 查询
    console.log('📖 读取数据库中的 HTML...');
    let content = null;
    let readError = null;
    let queryType = null;
    const isUUID = identifier.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    // 尝试作为 content_id 查询（UUID 格式）
    if (isUUID) {
      console.log('   尝试作为 content_id 查询...');
      const { data, error } = await DatabaseService.supabase
        .from('content')
        .select('id, short_id, title, full_html, created_at')
        .eq('id', identifier)
        .single();
      
      if (!error && data) {
        content = data;
        queryType = 'content_id';
      } else {
        readError = error;
        console.log('   content_id 查询失败，尝试作为 short_id 查询...');
      }
    }

    // 如果作为 content_id 查询失败或不是 UUID 格式，尝试作为 short_id 查询
    if (!content) {
      if (!isUUID) {
        console.log('   尝试作为 short_id 查询...');
      }
      const { data, error } = await DatabaseService.supabase
        .from('content')
        .select('id, short_id, title, full_html, created_at')
        .eq('short_id', identifier)
        .single();
      
      if (!error && data) {
        content = data;
        queryType = 'short_id';
        readError = null;
      } else {
        readError = error || readError;
      }
    }

    if (readError || !content) {
      console.error('❌ 读取失败:', readError?.message || '内容不存在');
      if (isUUID) {
        console.error('   已尝试: content_id 和 short_id 查询');
      } else {
        console.error('   已尝试: short_id 查询');
      }
      process.exit(1);
    }

    console.log(`✅ 成功读取 (通过 ${queryType}):`);
    console.log(`   - 标题: ${content.title || '(无标题)'}`);
    console.log(`   - Content ID: ${content.id}`);
    console.log(`   - Short ID: ${content.short_id || '(无)'}`);
    console.log(`   - HTML 长度: ${content.full_html?.length || 0} 字符\n`);

    console.log(`✅ 成功读取: ${content.title || content.short_id || contentId}`);
    console.log(`   HTML 长度: ${content.full_html?.length || 0} 字符\n`);

    if (!content.full_html) {
      console.error('❌ full_html 为空');
      process.exit(1);
    }

    const originalHtml = content.full_html;
    const originalLength = originalHtml.length;

    // 2. 使用 Renderer Engine 处理
    console.log('🔧 使用 Renderer Engine 处理...\n');
    const rendererEngine = createRendererEngine();
    const result = await rendererEngine.process(originalHtml, {
      autoFix: true,
      maxFixAttempts: 3
    });

    // 3. 显示修复结果
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  修复结果');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 统计:');
    console.log(`  - 检测到的问题: ${result.report?.summary?.issuesDetected || 0}`);
    console.log(`  - 修复的问题: ${result.report?.summary?.issuesFixed || 0}`);
    console.log(`  - 处理时间: ${result.report?.summary?.duration || 0}ms`);
    console.log(`  - 处理状态: ${result.report?.summary?.status || 'unknown'}\n`);

    // 显示检测到的问题详情
    const detectedIssues = result.report?.checks?.issues || result.unfixedIssues || [];
    if (detectedIssues.length > 0) {
      console.log('🔍 检测到的问题:');
      detectedIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.code}] ${issue.message || '未知问题'}`);
        console.log(`     严重程度: ${issue.severity || 'unknown'}`);
        console.log(`     可修复: ${issue.fixable ? '✅' : '❌'}`);
        if (issue.fixStrategy) {
          console.log(`     修复策略: ${issue.fixStrategy}`);
        }
      });
      console.log('');
    }

    // 显示所有修复尝试（包括成功和失败的）
    const allFixes = result.fixes || [];
    if (allFixes.length > 0) {
      console.log('🔧 所有修复尝试:');
      allFixes.forEach((fix, i) => {
        const status = fix.success ? '✅' : '❌';
        console.log(`  ${i + 1}. ${status} [${fix.issueCode}] ${fix.explanation || fix.error || '未知'}`);
        if (!fix.success && fix.error) {
          console.log(`     错误: ${fix.error}`);
        }
      });
      console.log('');
    }

    // 显示修复失败的原因
    const failedFixes = result.report?.fixes?.failed || [];
    if (failedFixes.length > 0) {
      console.log('❌ 修复失败详情:');
      failedFixes.forEach((fix, i) => {
        console.log(`  ${i + 1}. [${fix.issueCode}] ${fix.error || '未知错误'}`);
      });
      console.log('');
    }

    // 如果没有修复但有问题，显示可能的原因
    if (result.report?.summary?.issuesDetected > 0 && result.report?.summary?.issuesFixed === 0) {
      const fixableIssues = detectedIssues.filter(i => i.fixable);
      if (fixableIssues.length > 0) {
        console.log('⚠️  提示: 检测到可修复的问题，但修复失败。可能的原因：');
        console.log('   - 没有找到对应的 Fixer');
        console.log('   - Fixer 修复返回了 success: false');
        console.log('   - 修复过程中抛出了异常\n');
      } else {
        console.log('⚠️  提示: 检测到的问题都标记为不可修复\n');
      }
    }

    if (result.fixes && result.fixes.length > 0) {
      console.log('🔧 应用的修复:');
      result.fixes.forEach((fix, i) => {
        console.log(`  ${i + 1}. [${fix.issueCode}] ${fix.explanation || '未知修复'}`);
      });
      console.log('');
    }

    // 4. 验证修复效果
    console.log('✅ 验证修复效果:');
    const fixedHtml = result.html;
    const fixedLength = fixedHtml.length;

    // 检查 v-katex 属性中的双反斜杠（修复后的格式应该是 v-katex="'\\text{...}'"）
    const vKatexPattern = /v-katex\s*=\s*["'](['"`])([^'"`]*)\1["']/g;
    const vKatexMatches = [];
    let match;
    while ((match = vKatexPattern.exec(fixedHtml)) !== null) {
      vKatexMatches.push(match[2]); // 提取内容部分
    }
    
    // 检查常见的修复（在 v-katex 属性中）
    const vKatexContent = vKatexMatches.join(' ');
    const checks = {
      'v-katex 中包含 \\\\text': vKatexContent.includes('\\\\text') || vKatexContent.includes('\\text'),
      'v-katex 中包含 \\\\frac': vKatexContent.includes('\\\\frac'),
      'v-katex 中包含 \\\\sqrt': vKatexContent.includes('\\\\sqrt'),
      'v-katex 中包含 \\\\times': vKatexContent.includes('\\\\times'),
      'v-katex 中包含 \\\\approx': vKatexContent.includes('\\\\approx'),
      'v-katex 中包含 \\\\ln': vKatexContent.includes('\\\\ln'),
      'v-katex 中包含 \\\\prod': vKatexContent.includes('\\\\prod'),
      '包含 MathRenderManager': fixedHtml.includes('MathRenderManager'),
      '包含 auto-render.min.js': fixedHtml.includes('auto-render.min.js')
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    });
    console.log('');

    // 5. 显示修复前后对比（关键部分）
    console.log('📝 修复前后对比（v-katex 示例）:');
    const originalMatches = originalHtml.match(/v-katex\s*=\s*["'][^"']+["']/g) || [];
    const fixedMatches = fixedHtml.match(/v-katex\s*=\s*["'][^"']+["']/g) || [];

    // 显示有差异的 v-katex 属性
    let diffCount = 0;
    const maxShow = Math.min(originalMatches.length, fixedMatches.length);
    for (let i = 0; i < maxShow && diffCount < 3; i++) {
      const original = originalMatches[i] || '';
      const fixed = fixedMatches[i] || '';
      
      if (original !== fixed) {
        diffCount++;
        console.log(`\n  示例 ${diffCount}:`);
        console.log(`    修复前: ${original.substring(0, 100)}${original.length > 100 ? '...' : ''}`);
        console.log(`    修复后: ${fixed.substring(0, 100)}${fixed.length > 100 ? '...' : ''}`);
      }
    }
    
    if (diffCount === 0 && originalMatches.length > 0) {
      console.log('  (所有 v-katex 属性保持一致，无变化)');
    } else if (originalMatches.length === 0) {
      console.log('  (未找到 v-katex 属性)');
    }
    console.log('');

    // 6. 询问是否更新数据库
    if (originalHtml === fixedHtml) {
      console.log('💡 HTML 未发生变化，无需更新数据库\n');
    } else {
      console.log('💾 检测到 HTML 变化，准备更新数据库...');
      console.log(`   - 原始长度: ${originalLength} 字符`);
      console.log(`   - 修复后长度: ${fixedLength} 字符`);
      console.log(`   - 长度变化: ${fixedLength - originalLength > 0 ? '+' : ''}${fixedLength - originalLength} 字符\n`);

      // 更新数据库
      console.log('📝 更新数据库...');
      const { error: updateError } = await DatabaseService.supabase
        .from('content')
        .update({
          full_html: fixedHtml,
          updated_at: new Date().toISOString()
        })
        .eq('id', content.id); // 使用查询到的 content.id

      if (updateError) {
        console.error('❌ 更新失败:', updateError.message);
        process.exit(1);
      }

      console.log('✅ 数据库更新成功！\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  优化完成');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ 处理失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ 请提供 content_id 或 short_id');
    console.log('使用方法: node scripts/optimizeContentHtml.js <content_id|short_id>');
    console.log('  示例: node scripts/optimizeContentHtml.js abc123');
    console.log('  示例: node scripts/optimizeContentHtml.js 01881038-09d2-4646-b88a-8d4809a995da');
    process.exit(1);
  }

  await optimizeContentHtml(identifier);
}

main();
