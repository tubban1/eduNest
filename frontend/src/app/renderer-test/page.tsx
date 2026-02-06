'use client';

import React, { useState, useRef } from 'react';
import { api } from '@/lib/api';
import FullHTMLRenderer from '@/components/FullHTMLRenderer';
import { useAuth } from '@/hooks/useAuth';

// 差异对比算法：以 text2（右侧，基准）为基准，显示 text1（左侧，修改后）相对于 text2 的差异
// text2 = 基准（原始版本，来自 response_metadata）
// text1 = 修改后（来自 content.full_html）
function computeDiff(text1: string, text2: string) {
  const lines1 = text1.split('\n'); // 修改后的版本（左侧）
  const lines2 = text2.split('\n'); // 基准版本（右侧，现在移到左侧）
  
  const diff1: { line: string; type: 'same' | 'added' | 'removed' | 'modified'; pairIndex?: number }[] = [];
  const diff2: { line: string; type: 'same' | 'added' | 'removed' | 'modified'; pairIndex?: number }[] = [];
  
  // LCS 算法：text1 相对于 text2
  const m = lines1.length;
  const n = lines2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 计算 LCS
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // 回溯构建差异，改进算法以直接识别修改
  // diff2 显示基准版本（text2，左侧）
  // diff1 显示修改后版本（text1，右侧）
  let i = m, j = n;
  let pairIndex = 0;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      // 相同的行
      diff1.unshift({ line: lines1[i - 1], type: 'same' });
      diff2.unshift({ line: lines2[j - 1], type: 'same' });
      i--;
      j--;
    } else if (i > 0 && j > 0) {
      // 两边都有内容但不同，判断是修改还是删除+新增
      // 如果删除和新增会导致后续无法匹配更多行，则更可能是修改
      const deleteScore = dp[i][j - 1];
      const addScore = dp[i - 1][j];
      const bothDeleteAddScore = Math.max(deleteScore, addScore);
      
      // 如果删除和新增的得分相同，且前后都有匹配的行，更可能是修改
      const hasPrevMatch = i > 1 && j > 1 && lines1[i - 2] === lines2[j - 2];
      const hasNextMatch = i < m && j < n && lines1[i] === lines2[j];
      const isLikelyModification = 
        (deleteScore === addScore && (hasPrevMatch || hasNextMatch)) ||
        (Math.abs(deleteScore - addScore) <= 1 && hasPrevMatch && hasNextMatch);
      
      if (isLikelyModification) {
        // 标记为修改：同一位置，左侧显示旧内容，右侧显示新内容
        diff1.unshift({ line: lines1[i - 1], type: 'modified', pairIndex });
        diff2.unshift({ line: lines2[j - 1], type: 'modified', pairIndex });
        pairIndex++;
        i--;
        j--;
      } else {
        // 不是修改，按删除/新增处理
        if (deleteScore >= addScore) {
          // 优先删除
          diff2.unshift({ line: lines2[j - 1], type: 'removed' });
          diff1.unshift({ line: '', type: 'removed' });
          j--;
        } else {
          // 优先新增
          diff1.unshift({ line: lines1[i - 1], type: 'added' });
          diff2.unshift({ line: '', type: 'added' });
          i--;
        }
      }
    } else if (j > 0) {
      // 基准版本中有但修改后版本中没有（删除）
      diff2.unshift({ line: lines2[j - 1], type: 'removed' });
      diff1.unshift({ line: '', type: 'removed' });
      j--;
    } else {
      // 修改后版本中有但基准版本中没有（新增）
      diff1.unshift({ line: lines1[i - 1], type: 'added' });
      diff2.unshift({ line: '', type: 'added' });
      i--;
    }
  }
  
  // 辅助函数：检查两行是否相似（可能是修改而非删除+新增）
  const areLinesSimilar = (line1: string, line2: string): boolean => {
    if (!line1 || !line2) return false;
    // 提取标签名和主要属性
    const tag1 = line1.match(/<(\w+)/)?.[1] || '';
    const tag2 = line2.match(/<(\w+)/)?.[1] || '';
    if (tag1 && tag1 === tag2) return true; // 相同标签
    
    // 检查是否都包含相同的属性名
    const attrs1 = line1.match(/\s+(\w+)=/g) || [];
    const attrs2 = line2.match(/\s+(\w+)=/g) || [];
    if (attrs1.length > 0 && attrs2.length > 0) {
      const attrs1Set = new Set(attrs1);
      const attrs2Set = new Set(attrs2);
      const commonAttrs = [...attrs1Set].filter(a => attrs2Set.has(a));
      if (commonAttrs.length >= 2) return true; // 至少有2个相同属性
    }
    
    return false;
  };
  
  // 后处理：将相邻的删除+新增对合并为修改
  for (let k = 0; k < diff1.length - 1; k++) {
    // 情况1：基准版本删除（有旧内容）+ 修改后版本新增（有新内容）= 修改
    if (diff2[k].type === 'removed' && diff2[k].line && 
        diff1[k].type === 'removed' && !diff1[k].line &&
        diff2[k + 1].type === 'added' && !diff2[k + 1].line &&
        diff1[k + 1].type === 'added' && diff1[k + 1].line) {
      // 如果两行都是 HTML 标签行（包含 <），则认为是修改
      const isHtmlTag1 = diff2[k].line.trim().startsWith('<');
      const isHtmlTag2 = diff1[k + 1].line.trim().startsWith('<');
      
      // 如果内容相似或者是 HTML 标签，则合并为修改
      if (areLinesSimilar(diff2[k].line, diff1[k + 1].line) || (isHtmlTag1 && isHtmlTag2)) {
        // 合并为修改
        diff2[k] = { line: diff2[k].line, type: 'modified', pairIndex };
        diff1[k] = { line: diff1[k + 1].line, type: 'modified', pairIndex };
        diff1.splice(k + 1, 1);
        diff2.splice(k + 1, 1);
        pairIndex++;
        k--;
      }
    }
  }
  
  return { diff1, diff2 };
}

export default function RendererTestPage() {
  const { user } = useAuth();
  const [shortId, setShortId] = useState('');
  const [contentId, setContentId] = useState<string | null>(null); // 保存 content ID 用于更新
  const [html1, setHtml1] = useState(''); // 左侧：来自 response_metadata
  const [html2, setHtml2] = useState(''); // 右侧：来自 content.full_html
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fixLogs, setFixLogs] = useState<any[]>([]);
  const [renderSource, setRenderSource] = useState<'html1' | 'html2'>('html1');
  const [showDiff, setShowDiff] = useState(true); // 默认开启差异对比
  const codeEditor1Ref = useRef<HTMLTextAreaElement>(null);
  const codeEditor2Ref = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // 计算差异：以 html1（基准，来自 response_metadata）为基础，显示 html2（修改后，来自 content.full_html）相对于 html1 的差异
  // diff1 显示基准版本（html1，来自 response_metadata，左侧）
  // diff2 显示修改后版本（html2，来自 content.full_html，右侧）
  const diffResult = showDiff && html1 && html2 ? computeDiff(html2, html1) : null;

  // 根据 short_id 加载内容
  const loadContentByShortId = async () => {
    if (!shortId.trim()) {
      alert('请输入 short_id');
      return;
    }

    setLoading(true);
    setFixLogs([]);
    setHtml1('');
    setHtml2('');
    
    try {
      // 1. 获取 content 信息（包含 uuid 和 full_html）
      const contentResponse = await api.get(`/renderer-test/content/${shortId}`);
      if (!contentResponse.success || !contentResponse.data) {
        throw new Error(contentResponse.error || '加载内容失败');
      }
      
      const contentId = contentResponse.data.id;
      const fullHtml = contentResponse.data.full_html || '';
      
      // 保存 content ID 用于后续更新
      setContentId(contentId);
      
      // 设置右侧代码框（来自 content.full_html）
      setHtml2(fullHtml);
      
      // 2. 根据 content_id 查找 ai_usage_logs，从 response_metadata 提取 full_html
      const metadataResponse = await api.get(`/renderer-test/metadata-by-content/${contentId}`);
      if (metadataResponse.success && metadataResponse.data && metadataResponse.data.full_html) {
        setHtml1(metadataResponse.data.full_html);
        setFixLogs(prev => [...prev, {
          type: 'info',
          message: `成功加载：左侧来自 response_metadata，右侧来自 content.full_html`,
          timestamp: new Date().toISOString()
        }]);
      } else {
        // 如果没有找到 metadata，只显示 content.full_html
        setFixLogs(prev => [...prev, {
          type: 'warning',
          message: `未找到对应的 ai_usage_logs 记录，只显示 content.full_html`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error: any) {
      setFixLogs(prev => [...prev, {
        type: 'error',
        message: `加载失败: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString()
      }]);
      alert(`加载失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 修复 HTML（以左侧代码框内容为修复基础，修复后显示到右侧代码框）
  const fixHtml = async () => {
    const htmlToFix = html1; // 使用左侧代码框（来自 response_metadata）作为修复基础
    if (!htmlToFix.trim()) {
      alert('请先加载 HTML 内容（左侧代码框）');
      return;
    }

    setFixing(true);
    setFixLogs(prev => [...prev, {
      type: 'info',
      message: '开始修复（基于左侧代码框内容）...',
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await api.post('/renderer-test/fix', { html: htmlToFix });
      if (response.success && response.data) {
        const { fixedHtml, report, fixes, unfixedIssues } = response.data;
        
        // 更新 HTML（更新右侧代码框）
        setHtml2(fixedHtml);
        // 自动切换预览到修复结果，便于直接查看渲染效果
        setRenderSource('html2');
        setTimeout(() => {
          previewContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        
        // 记录修复日志
        const newLogs: any[] = [];
        
        // 报告摘要
        if (report?.summary) {
          newLogs.push({
            type: 'success',
            message: `修复完成 - 检测到 ${report.summary.issuesDetected} 个问题，修复了 ${report.summary.issuesFixed} 个`,
            timestamp: new Date().toISOString(),
            data: report.summary
          });
        }
        
        // 检测到的问题（详细列出）
        if (report?.checks?.issues && report.checks.issues.length > 0) {
          report.checks.issues.forEach((issue: any) => {
            newLogs.push({
              type: issue.fixable ? 'info' : 'warning',
              message: `[检测] ${issue.code}: ${issue.message} ${issue.fixable ? '(可修复)' : '(不可修复)'}`,
              timestamp: new Date().toISOString(),
              data: issue
            });
          });
        }
        
        // 修复尝试（详细列出每个修复）
        if (fixes && fixes.length > 0) {
          fixes.forEach((fix: any) => {
            newLogs.push({
              type: fix.success ? 'success' : 'error',
              message: `[修复${fix.success ? '成功' : '失败'}] ${fix.issueCode}: ${fix.explanation || fix.error || '未知'}`,
              timestamp: new Date().toISOString(),
              data: fix
            });
          });
        } else {
          newLogs.push({
            type: 'info',
            message: '未执行任何修复操作',
            timestamp: new Date().toISOString()
          });
        }
        
        // 未修复的问题（详细列出）
        if (unfixedIssues && unfixedIssues.length > 0) {
          unfixedIssues.forEach((issue: any) => {
            newLogs.push({
              type: 'warning',
              message: `[未修复] ${issue.code}: ${issue.message || '未知问题'}`,
              timestamp: new Date().toISOString(),
              data: issue
            });
          });
        }
        
        // 打印完整报告到控制台
        console.log('=== Renderer Engine 修复报告 ===');
        console.log('报告摘要:', report?.summary);
        console.log('检测到的问题:', report?.checks?.issues);
        console.log('修复尝试:', fixes);
        console.log('未修复的问题:', unfixedIssues);
        console.log('修复后的 HTML 长度:', fixedHtml.length);
        console.log('原始 HTML 长度:', htmlToFix.length);
        console.log('================================');
        
        setFixLogs(prev => [...prev, ...newLogs]);
      } else {
        throw new Error(response.error || '修复失败');
      }
    } catch (error: any) {
      setFixLogs(prev => [...prev, {
        type: 'error',
        message: `修复失败: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString(),
        error: error
      }]);
      alert(`修复失败: ${error.message || '未知错误'}`);
    } finally {
      setFixing(false);
    }
  };

  // 复制代码框内容到剪贴板
  const copyToClipboard = async (text: string, source: 'html1' | 'html2') => {
    try {
      await navigator.clipboard.writeText(text);
      setFixLogs(prev => [...prev, {
        type: 'success',
        message: `已复制代码框 ${source === 'html1' ? '1' : '2'} 的内容到剪贴板`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error: any) {
      setFixLogs(prev => [...prev, {
        type: 'error',
        message: `复制失败: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // 复制所有日志到剪贴板
  const copyAllLogs = async () => {
    if (fixLogs.length === 0) {
      alert('没有日志可复制');
      return;
    }

    try {
      // 格式化日志为文本
      const logText = fixLogs.map((log, index) => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const typeStr = log.type === 'error' ? '[错误]' : 
                       log.type === 'success' ? '[成功]' : 
                       log.type === 'warning' ? '[警告]' : 
                       '[信息]';
        let text = `${index + 1}. ${timeStr} ${typeStr} ${log.message}`;
        
        if (log.data) {
          text += '\n   数据: ' + JSON.stringify(log.data, null, 2);
        }
        
        if (log.error) {
          text += '\n   错误: ' + (log.error.message || JSON.stringify(log.error));
        }
        
        return text;
      }).join('\n\n');

      await navigator.clipboard.writeText(logText);
      setFixLogs(prev => [...prev, {
        type: 'success',
        message: `已复制所有 ${fixLogs.length} 条日志到剪贴板`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error: any) {
      setFixLogs(prev => [...prev, {
        type: 'error',
        message: `复制日志失败: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // 保存修复后的 HTML 到 content.full_html
  const saveFixedHtml = async () => {
    if (!contentId) {
      alert('无法保存：缺少 content ID');
      return;
    }

    if (!html2.trim()) {
      alert('右侧代码框为空，无法保存');
      return;
    }

    setSaving(true);
    setFixLogs(prev => [...prev, {
      type: 'info',
      message: '正在保存修复后的 HTML 到 content.full_html...',
      timestamp: new Date().toISOString()
    }]);

    try {
      // 直接调用 API，不使用 content.update，以便获取更详细的错误信息
      const response = await api.put(`/content/${contentId}`, {
        full_html: html2
      });

      if (response && response.success) {
        setFixLogs(prev => [...prev, {
          type: 'success',
          message: '保存成功！修复后的 HTML 已更新到 content.full_html',
          timestamp: new Date().toISOString(),
          data: response.data || { contentId, saved: true }
        }]);
        alert('保存成功！');
      } else {
        const errorMsg = response?.error || '保存失败：API 返回失败';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      setFixLogs(prev => [...prev, {
        type: 'error',
        message: `保存失败: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString(),
        error: error
      }]);
      alert(`保存失败: ${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-[1920px] mx-auto">
        <h1 className="text-2xl font-bold mb-4">Renderer Engine 测试工具</h1>
        
        {/* 输入区域 */}
        <div className="mb-4">
          <div className="bg-white p-4 rounded-lg shadow max-w-md">
            <label className="block text-sm font-medium mb-2">Short ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shortId}
                onChange={(e) => setShortId(e.target.value)}
                placeholder="输入 short_id"
                className="flex-1 border border-gray-300 rounded px-3 py-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadContentByShortId();
                  }
                }}
              />
              <button
                onClick={loadContentByShortId}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '加载中...' : '加载'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              左侧：从 ai_usage_logs.response_metadata 提取 | 右侧：从 content.full_html
            </p>
          </div>
        </div>
        
        {/* 差异对比控制 */}
        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDiff}
              onChange={(e) => setShowDiff(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">显示差异对比</span>
          </label>
          {showDiff && diffResult && (
            <div className="text-sm text-gray-600">
              <span className="inline-block w-3 h-3 bg-red-200 mr-1"></span>删除
              <span className="inline-block w-3 h-3 bg-green-200 mr-1 ml-3"></span>添加
              <span className="inline-block w-3 h-3 bg-yellow-200 mr-1 ml-3"></span>修改
            </div>
          )}
        </div>
        
        {/* 代码编辑器区域 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* 代码框 1 - 基准版本（左侧，来自 response_metadata） */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b flex items-center justify-between">
              <label className="font-medium">代码框 1 (基准 - 来自 response_metadata)</label>
              <div className="flex gap-2">
                <button
                  onClick={fixHtml}
                  disabled={fixing || !html1.trim()}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                  title="以左侧代码框内容为修复基础"
                >
                  {fixing ? '修复中...' : '修复'}
                </button>
                <button
                  onClick={() => copyToClipboard(html1, 'html1')}
                  disabled={!html1.trim()}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                  title="复制代码框 1 的所有内容"
                >
                  复制
                </button>
                <button
                  onClick={() => setRenderSource('html1')}
                  className={`px-3 py-1 text-sm rounded ${
                    renderSource === 'html1'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  渲染此内容
                </button>
              </div>
            </div>
            {showDiff && diffResult ? (
              <div className="relative h-96 overflow-auto">
                <div className="flex">
                  {/* 行号 */}
                  <div className="w-12 bg-gray-50 border-r border-gray-200 font-mono text-sm text-gray-400 select-none sticky left-0 z-10">
                    {diffResult.diff2.map((item, i) => (
                      <div
                        key={i}
                        className={`h-6 leading-6 px-2 text-right ${
                          item.type === 'removed' ? 'bg-red-100' :
                          item.type === 'added' ? 'bg-green-100' :
                          item.type === 'modified' ? 'bg-yellow-100' :
                          ''
                        }`}
                      >
                        {item.type !== 'added' ? i + 1 : ''}
                      </div>
                    ))}
                  </div>
                  {/* 代码内容 - 显示基准版本（html1，来自 response_metadata） */}
                  <div className="flex-1 font-mono text-sm">
                    {diffResult.diff2.map((item, i) => (
                      <div
                        key={i}
                        className={`h-6 leading-6 px-3 whitespace-pre ${
                          item.type === 'removed' ? 'bg-red-50 text-red-800' :
                          item.type === 'added' ? 'bg-green-50 text-green-800' :
                          item.type === 'modified' ? 'bg-yellow-50 text-yellow-800' :
                          'bg-white'
                        }`}
                      >
                        {item.line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  ref={codeEditor1Ref}
                  value={html1}
                  onChange={(e) => setHtml1(e.target.value)}
                  className="w-full h-96 p-3 pl-12 font-mono text-sm border-0 focus:outline-none resize-none"
                  placeholder="HTML 代码将显示在这里..."
                  style={{ tabSize: 2 }}
                />
                {/* 行号显示 */}
                <div className="absolute left-0 top-0 h-96 overflow-hidden pointer-events-none">
                  <div className="p-3 font-mono text-sm text-gray-400 select-none">
                    {html1.split('\n').map((_, i) => (
                      <div key={i} className="h-[1.5rem] leading-6">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 代码框 2 - 修改后版本（右侧，来自 content.full_html） */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-3 border-b flex items-center justify-between">
              <label className="font-medium">代码框 2 (修改后 - 来自 content.full_html)</label>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(html2, 'html2')}
                  disabled={!html2.trim()}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                  title="复制代码框 2 的所有内容"
                >
                  复制
                </button>
                <button
                  onClick={saveFixedHtml}
                  disabled={saving || !contentId || !html2.trim()}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  title="保存修复后的 HTML 到 content.full_html"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setRenderSource('html2')}
                  className={`px-3 py-1 text-sm rounded ${
                    renderSource === 'html2'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  渲染此内容
                </button>
              </div>
            </div>
            {showDiff && diffResult ? (
              <div className="relative h-96 overflow-auto">
                <div className="flex">
                  {/* 行号 */}
                  <div className="w-12 bg-gray-50 border-r border-gray-200 font-mono text-sm text-gray-400 select-none sticky left-0 z-10">
                    {diffResult.diff1.map((item, i) => (
                      <div
                        key={i}
                        className={`h-6 leading-6 px-2 text-right ${
                          item.type === 'removed' ? 'bg-red-100' :
                          item.type === 'added' ? 'bg-green-100' :
                          item.type === 'modified' ? 'bg-yellow-100' :
                          ''
                        }`}
                      >
                        {item.type !== 'removed' ? i + 1 : ''}
                      </div>
                    ))}
                  </div>
                  {/* 代码内容 - 显示修改后版本（html2，来自 content.full_html） */}
                  <div className="flex-1 font-mono text-sm">
                    {diffResult.diff1.map((item, i) => (
                      <div
                        key={i}
                        className={`h-6 leading-6 px-3 whitespace-pre ${
                          item.type === 'removed' ? 'bg-red-50 text-red-800' :
                          item.type === 'added' ? 'bg-green-50 text-green-800' :
                          item.type === 'modified' ? 'bg-yellow-50 text-yellow-800' :
                          'bg-white'
                        }`}
                      >
                        {item.line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  ref={codeEditor2Ref}
                  value={html2}
                  onChange={(e) => setHtml2(e.target.value)}
                  className="w-full h-96 p-3 pl-12 font-mono text-sm border-0 focus:outline-none resize-none"
                  placeholder="HTML 代码将显示在这里..."
                  style={{ tabSize: 2 }}
                />
                {/* 行号显示 */}
                <div className="absolute left-0 top-0 h-96 overflow-hidden pointer-events-none">
                  <div className="p-3 font-mono text-sm text-gray-400 select-none">
                    {html2.split('\n').map((_, i) => (
                      <div key={i} className="h-[1.5rem] leading-6">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 修复日志 */}
        {fixLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-4">
            <div className="p-3 border-b flex items-center justify-between">
              <label className="font-medium">修复日志 ({fixLogs.length} 条)</label>
              <button
                onClick={copyAllLogs}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                title="复制所有日志到剪贴板"
              >
                复制所有日志
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {fixLogs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-2 p-2 rounded text-sm ${
                    log.type === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : log.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : log.type === 'warning'
                      ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <div className="font-medium">{log.message}</div>
                  {log.data && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs opacity-75">查看详情</summary>
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 渲染器：修复后会自动切换到此预览，直接查看渲染结果 */}
        <div ref={previewContainerRef} className="bg-white rounded-lg shadow">
          <div className="p-3 border-b">
            <label className="font-medium">
              渲染预览 (当前: {renderSource === 'html1' ? '代码框 1 (基准)' : '代码框 2 (修复结果)'})
            </label>
          </div>
          <div className="h-[600px] border-t">
            <FullHTMLRenderer
              fullHTML={renderSource === 'html1' ? html1 : html2}
              autoHeight={false}
              fixedHeight={true}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
