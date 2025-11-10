'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import PendingCard from '@/components/generation/PendingCard';
import ProcessingCard from '@/components/generation/ProcessingCard';
import FailedCard from '@/components/generation/FailedCard';
import { GenerationStatus } from '@/utils/generationStatus';

// 模拟测试内容数据
const mockTestContents = [
  {
    id: 'test-content-1',
    title: '测试内容1 - 等待中',
    created_at: new Date().toISOString(),
    generation_status: 'pending' as GenerationStatus,
    generation_progress: 0,
    retry_count: 0,
    generation_error: null,
    user_query: '小学数学加法运算基础'
  },
  {
    id: 'test-content-2', 
    title: '测试内容2 - 生成中',
    created_at: new Date().toISOString(),
    generation_status: 'processing' as GenerationStatus,
    generation_progress: 50,
    retry_count: 1,
    generation_error: null,
    user_query: '初中数学几何图形识别'
  },
  {
    id: 'test-content-3',
    title: '测试内容3 - 生成失败',
    created_at: new Date().toISOString(),
    generation_status: 'failed' as GenerationStatus,
    generation_progress: 0,
    retry_count: 2,
    generation_error: 'JSON解析失败: 无法解析AI返回的内容',
    user_query: '高中数学微积分基础概念'
  }
];

export default function TestRetryPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [testContents, setTestContents] = useState(mockTestContents);
  const [isRetrying, setIsRetrying] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]); // 保留最近10条日志
  };

  // 重试处理函数
  const handleRetry = async (contentId: string) => {
    setIsRetrying(prev => ({ ...prev, [contentId]: true }));
    addLog(`开始重试内容: ${contentId}`);
    
    // 检查是否是模拟的测试内容
    const isMockContent = contentId.startsWith('test-content-');
    
    if (isMockContent) {
      addLog(`检测到模拟内容，使用真实API重试: ${contentId}`);
      
      // 获取模拟内容的user_query
      const mockContent = testContents.find(content => content.id === contentId);
      const userQuery = mockContent?.user_query || '小学数学加法运算';
      
      addLog(`使用user_query: ${userQuery}`);
      
      try {
        // 创建真实内容并启动生成
        const response = await api.content.create({
          title: `重试测试内容 ${new Date().toLocaleTimeString()}`,
          description: '通过重试按钮创建的真实测试内容',
          full_html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>测试内容</title></head><body><div>测试内容</div></body></html>`,
          tags: ['重试测试'],
          content_type: 'vue',
          language_code: 'zh-CN'
        });
        
        if (response && response.id) {
          addLog(`✅ 重试内容创建成功: ${response.id}`);
          addLog(`响应数据: ${JSON.stringify(response)}`);
          
          // 启动异步生成
          const generateParams = {
            knowledge_point: userQuery,
            learning_stage: 'understanding',
            description: '通过重试按钮触发的真实生成',
            language_code: 'zh-CN',
            provider: 'kimi'
          };
          
          addLog(`生成参数: ${JSON.stringify(generateParams)}`);
          
          const generateResponse = await api.generateContentAsync(response.id, generateParams);
          
          if (generateResponse.success) {
            addLog(`✅ 重试异步生成启动成功`);
            addLog(`请求ID: ${generateResponse.data.request_id}`);
            
            // 添加到测试内容列表
            const newContent = {
              id: response.id,
              title: response.title,
              created_at: response.created_at,
              generation_status: 'pending' as GenerationStatus,
              generation_progress: 0,
              retry_count: 0,
              generation_error: null,
              user_query: userQuery
            };
            
            setTestContents(prev => [newContent, ...prev]);
            addLog(`✅ 重试内容已添加到列表`);
            
            // 开始真实状态轮询
            startRealStatusPolling(response.id);
            
            // 更新原模拟卡片状态为成功
            setTestContents(prev => prev.map(content => 
              content.id === contentId 
                ? { 
                    ...content, 
                    generation_status: 'done' as GenerationStatus,
                    generation_progress: 100,
                    retry_count: 0,
                    generation_error: null
                  }
                : content
            ));
            
          } else {
            addLog(`❌ 重试异步生成启动失败: ${generateResponse.error}`);
            setIsRetrying(prev => ({ ...prev, [contentId]: false }));
          }
        } else {
          addLog(`❌ 重试内容创建失败: 响应格式不正确`);
          addLog(`响应内容: ${JSON.stringify(response)}`);
          setIsRetrying(prev => ({ ...prev, [contentId]: false }));
        }
      } catch (error) {
        addLog(`❌ 重试异常: ${error instanceof Error ? error.message : String(error)}`);
        setIsRetrying(prev => ({ ...prev, [contentId]: false }));
      }
      return;
    }
    
    try {
      // 调用真实的重试API
      const response = await api.retryFailedTask(contentId);
      addLog(`重试API响应: ${JSON.stringify(response)}`);
      
      if (response.success) {
        // 更新测试内容状态
        setTestContents(prev => prev.map(content => 
          content.id === contentId 
            ? { 
                ...content, 
                generation_status: 'pending' as GenerationStatus,
                generation_progress: 0,
                retry_count: 0,
                generation_error: null
              }
            : content
        ));
        addLog(`重试成功，状态已重置: ${contentId}`);
        
        // 模拟状态轮询
        simulateStatusPolling(contentId);
      } else {
        addLog(`重试失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      addLog(`重试异常: ${error instanceof Error ? error.message : String(error)}`);
      
      // 如果是404错误，说明内容不存在，提供友好的提示
      if (error instanceof Error && error.message.includes('404')) {
        addLog(`提示: 内容ID "${contentId}" 不存在于数据库中，请使用"创建真实测试内容"功能`);
      }
    } finally {
      setIsRetrying(prev => ({ ...prev, [contentId]: false }));
    }
  };

  // 模拟状态轮询
  const simulateStatusPolling = (contentId: string) => {
    addLog(`开始模拟状态轮询: ${contentId}`);
    
    // 模拟状态变化: pending -> processing -> done/failed
    const statusSequence = [
      { status: 'pending', progress: 10, delay: 1000 },
      { status: 'processing', progress: 50, delay: 2000 },
      { status: 'processing', progress: 80, delay: 3000 },
      { status: 'failed', progress: 0, delay: 0 } // 模拟失败
    ];
    
    let currentIndex = 0;
    
    const updateStatus = () => {
      if (currentIndex >= statusSequence.length) return;
      
      const currentStatus = statusSequence[currentIndex];
      addLog(`状态更新: ${contentId} -> ${currentStatus.status} (${currentStatus.progress}%)`);
      
      setTestContents(prev => prev.map(content => 
        content.id === contentId 
          ? { 
              ...content, 
              generation_status: currentStatus.status as GenerationStatus,
              generation_progress: currentStatus.progress,
              retry_count: currentStatus.status === 'failed' ? 2 : content.retry_count,
              generation_error: currentStatus.status === 'failed' ? '模拟生成失败' : null
            }
          : content
      ));
      
      currentIndex++;
      if (currentIndex < statusSequence.length) {
        setTimeout(updateStatus, statusSequence[currentIndex - 1].delay);
      }
    };
    
    setTimeout(updateStatus, 1000);
  };

  // 创建真实测试内容
  const createTestContent = async () => {
    if (!isAuthenticated) {
      addLog('用户未登录，无法创建测试内容');
      return;
    }
    
    try {
      addLog('=== 开始创建真实测试内容 ===');
      addLog('用户ID: ' + user?.id);
      
      // 使用当前失败卡片的user_query
      const failedContent = testContents.find(content => content.generation_status === 'failed');
      const userQuery = failedContent?.user_query || '小学数学加法运算';
      
      addLog(`使用user_query: ${userQuery}`);
      
      // 创建内容
      addLog('步骤1: 创建内容记录...');
      const response = await api.content.create({
        title: `真实测试内容 ${new Date().toLocaleTimeString()}`,
        description: '用于测试重试功能的真实测试内容',
        code_html: '',
        code_css: '',
        code_js: '',
        external_links: [],
        tags: ['真实测试'],
        content_type: 'vue',
        language_code: 'zh-CN'
      });
      
      if (response && response.id) {
        addLog(`✅ 内容创建成功: ${response.id}`);
        addLog(`响应数据: ${JSON.stringify(response)}`);
        
        // 启动异步生成
        addLog('步骤2: 启动异步生成...');
        const generateParams = {
          knowledge_point: userQuery,
          learning_stage: 'understanding',
          description: '测试重试功能的真实生成',
          language_code: 'zh-CN',
          provider: 'kimi'
        };
        
        addLog(`生成参数: ${JSON.stringify(generateParams)}`);
        
        const generateResponse = await api.generateContentAsync(response.data.id, generateParams);
        
        if (generateResponse.success) {
          addLog(`✅ 异步生成启动成功`);
          addLog(`请求ID: ${generateResponse.data.request_id}`);
          
          // 添加到测试内容列表
          const newContent = {
            id: response.id,
            title: response.title,
            created_at: response.created_at,
            generation_status: 'pending' as GenerationStatus,
            generation_progress: 0,
            retry_count: 0,
            generation_error: null,
            user_query: userQuery
          };
          
          setTestContents(prev => [newContent, ...prev]);
          addLog(`✅ 测试内容已添加到列表`);
          
          // 开始真实状态轮询
          addLog('步骤3: 开始真实状态轮询...');
          startRealStatusPolling(response.id);
          
        } else {
          addLog(`❌ 异步生成启动失败: ${generateResponse.error}`);
        }
      } else {
        addLog(`❌ 内容创建失败: 响应格式不正确`);
        addLog(`响应内容: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      addLog(`❌ 创建测试内容异常: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error) {
        addLog(`错误堆栈: ${error.stack}`);
      }
    }
  };

  // 真实状态轮询
  const startRealStatusPolling = async (contentId: string) => {
    addLog(`开始真实状态轮询: ${contentId}`);
    
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await api.getContentGenerationStatus(contentId);
        
        if (statusResponse.success) {
          const statusData = statusResponse.data;
          addLog(`状态轮询结果: ${JSON.stringify(statusData)}`);
          
          // 更新测试内容状态
          setTestContents(prev => prev.map(content => 
            content.id === contentId 
              ? { 
                  ...content, 
                  generation_status: statusData.status as GenerationStatus,
                  generation_progress: statusData.progress || 0,
                  retry_count: statusData.retry_count || 0,
                  generation_error: statusData.error_message,
                  user_query: statusData.user_query || content.user_query
                }
              : content
          ));
          
          // 如果生成完成，获取AI响应内容
          if (statusData.status === 'done') {
            addLog(`🎉 生成完成，获取AI响应内容...`);
            await fetchAndDisplayAIResponse(contentId, statusData.latest_request_id);
            clearInterval(pollInterval);
            addLog(`✅ 状态轮询结束: done`);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            addLog(`❌ 状态轮询结束: failed`);
          } else {
            addLog(`⏳ 继续等待生成完成... (当前状态: ${statusData.status})`);
          }
        } else {
          addLog(`状态轮询失败: ${statusResponse.error}`);
        }
      } catch (error) {
        addLog(`状态轮询异常: ${error instanceof Error ? error.message : String(error)}`);
        clearInterval(pollInterval);
      }
    }, 2000); // 每2秒轮询一次
    
    // 5分钟后自动停止轮询
    setTimeout(() => {
      clearInterval(pollInterval);
      addLog(`状态轮询超时停止: ${contentId}`);
    }, 300000);
  };

  // 获取并显示AI响应内容
  const fetchAndDisplayAIResponse = async (contentId: string, requestId: string) => {
    try {
      addLog(`获取AI响应内容: requestId=${requestId}`);
      
      // 获取内容详情
      const contentData = await api.content.getById(contentId);
      if (contentData) {
        addLog(`✅ 获取内容成功`);
        addLog(`标题: ${contentData.title}`);
        addLog(`Full HTML长度: ${contentData.full_html?.length || 0} 字符`);
        
        // 更新卡片显示AI生成的内容
        setTestContents(prev => prev.map(content => 
          content.id === contentId 
            ? { 
                ...content, 
                title: contentData.title,
                description: contentData.description || 'AI生成的教育内容',
                full_html: contentData.full_html || '',
                tags: contentData.tags || ['AI生成']
              }
            : content
        ));
        
        addLog(`✅ AI响应内容已更新到卡片`);
      } else {
        addLog(`❌ 获取内容失败: 内容不存在`);
      }
    } catch (error) {
      addLog(`❌ 获取AI响应异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 清空日志
  const clearLogs = () => {
    setLogs([]);
  };

  // 重置测试内容
  const resetTestContents = () => {
    setTestContents(mockTestContents);
    addLog('测试内容已重置');
  };

  // 手动刷新所有内容状态
  const refreshAllContentStatus = async () => {
    if (!isAuthenticated) {
      addLog('用户未登录，无法刷新状态');
      return;
    }
    
    try {
      addLog('=== 手动刷新所有内容状态 ===');
      
      for (const content of testContents) {
        if (content.id.startsWith('test-content-')) {
          addLog(`跳过模拟内容: ${content.id}`);
          continue;
        }
        
        try {
          addLog(`刷新内容状态: ${content.id}`);
          const statusResponse = await api.getContentGenerationStatus(content.id);
          
          if (statusResponse.success) {
            const statusData = statusResponse.data;
            addLog(`内容 ${content.id} 状态: ${statusData.status}`);
            
            // 更新状态
            setTestContents(prev => prev.map(c => 
              c.id === content.id 
                ? { 
                    ...c, 
                    generation_status: statusData.status as GenerationStatus,
                    generation_progress: statusData.progress || 0,
                    retry_count: statusData.retry_count || 0,
                    generation_error: statusData.error_message,
                    user_query: statusData.user_query || c.user_query
                  }
                : c
            ));
            
            // 如果状态是done，获取内容详情
            if (statusData.status === 'done') {
              addLog(`获取已完成内容的详情: ${content.id}`);
              await fetchAndDisplayAIResponse(content.id, statusData.latest_request_id);
            }
          } else {
            addLog(`刷新内容 ${content.id} 状态失败: ${statusResponse.error}`);
          }
        } catch (error) {
          addLog(`刷新内容 ${content.id} 状态异常: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      addLog('=== 状态刷新完成 ===');
    } catch (error) {
      addLog(`❌ 刷新状态异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 导航栏 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <a href="/" className="text-blue-600 hover:text-blue-800">← 返回首页</a>
              <a href="/c" className="text-blue-600 hover:text-blue-800">内容列表</a>
              <a href="/test-status" className="text-blue-600 hover:text-blue-800">状态测试</a>
            </div>
            <div className="text-sm text-gray-500">
              重试功能调试页面
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">重试功能测试页面</h1>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={createTestContent}
              disabled={!isAuthenticated}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建真实测试内容
            </button>
            <button
              onClick={refreshAllContentStatus}
              disabled={!isAuthenticated}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              刷新状态
            </button>
            <button
              onClick={resetTestContents}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              重置模拟内容
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              清空日志
            </button>
          </div>

          {!isAuthenticated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800">请先登录以使用真实API功能</p>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-blue-800 font-semibold mb-2">使用说明</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• <strong>模拟卡片重试</strong>: 点击失败卡片的"重试"按钮会创建真实内容并调用AI模型</li>
              <li>• <strong>真实测试</strong>: 点击"创建真实测试内容"会使用失败卡片的user_query提交到AI模型</li>
              <li>• <strong>刷新状态</strong>: 点击"刷新状态"按钮可以手动检查所有内容的最新状态</li>
              <li>• <strong>AI响应</strong>: 生成完成后会自动获取AI响应内容并更新到卡片中</li>
              <li>• <strong>调试日志</strong>: 页面底部显示所有操作的详细日志，包括AI响应内容</li>
              <li>• <strong>真实API</strong>: 现在所有重试都会调用真实的API接口，不再是模拟</li>
            </ul>
          </div>
        </div>

        {/* 测试卡片区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {testContents.map((content) => (
            <div key={content.id} className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold mb-4">{content.title}</h3>
              
              {content.generation_status === 'pending' && (
                <PendingCard content={content} userQuery={content.user_query} />
              )}
              
              {content.generation_status === 'processing' && (
                <ProcessingCard 
                  content={content} 
                  progress={content.generation_progress}
                  retryCount={content.retry_count}
                  userQuery={content.user_query}
                />
              )}
              
              {content.generation_status === 'failed' && (
                <FailedCard
                  content={content}
                  errorMessage={content.generation_error || undefined}
                  retryCount={content.retry_count}
                  userQuery={content.user_query}
                  onRetry={() => handleRetry(content.id)}
                  isRetrying={isRetrying[content.id] || false}
                />
              )}
            </div>
          ))}
        </div>

        {/* 日志区域 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">调试日志</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">暂无日志...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
