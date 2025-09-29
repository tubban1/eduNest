'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const TEST_REQUEST_IDS = [
  'e6b3fe5c-fc9e-400d-a16b-fd37218b9f70',
  'a25641f1-83c9-439a-9083-d2cbfcdbdf83',
  '24ac0efe-7729-4f42-a16a-8150a7550016',
  'e3ca66d3-1003-465a-acf9-d55d0ce41852',
  '78244164-c3f7-4a53-86c8-386e1c6af5b0',
  'bbe544fb-3292-499d-9e61-24f87cf4f35c',
  '13f55663-96f0-4c51-bf1e-b51a72fb4ab2',
  '9712c5ab-3f37-44ff-a979-259ba7b6383b'
];

export default function TestReloadPage() {
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleTestReload = async () => {
    if (!selectedRequestId) return;
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await api.reloadAiResult(selectedRequestId);
      
      if (response.success) {
        setResult(response.data);
        console.log('重新加载成功:', response);
      } else {
        setError(response.error || '重新加载失败');
      }
    } catch (err: any) {
      console.error('重新加载失败:', err);
      setError(err.message || '重新加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogs = async () => {
    if (!selectedRequestId) return;
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await api.getAiLogByRequestId(selectedRequestId);
      
      if (response.success) {
        setResult(response.data);
        console.log('日志查询成功:', response);
      } else {
        setError(response.error || '日志查询失败');
      }
    } catch (err: any) {
      console.error('日志查询失败:', err);
      setError(err.message || '日志查询失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI 重新加载测试页面</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">选择 Request ID 进行测试</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择 Request ID:
            </label>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">请选择一个 Request ID</option>
              {TEST_REQUEST_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleTestReload}
              disabled={!selectedRequestId || loading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {loading ? '测试中...' : '测试重新加载 API'}
            </button>
            
            <button
              onClick={handleTestLogs}
              disabled={!selectedRequestId || loading}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              {loading ? '测试中...' : '测试日志查询 API'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">错误信息:</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-green-800 font-semibold mb-4">查询结果:</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">基本信息:</h4>
                <div className="bg-white p-3 rounded border text-sm">
                  <p><strong>Request ID:</strong> {selectedRequestId}</p>
                  <p><strong>查询时间:</strong> {new Date().toLocaleString()}</p>
                </div>
              </div>

              {/* 提取的字段显示 */}
content              {(() => {
                // 尝试从不同位置提取数据
                let extractedData = null;
                
                // 1. 尝试从 response_meta 直接获取
                if (result.response_meta) {
                  extractedData = result.response_meta;
                }
                // 2. 尝试从 choices[0].message.content 解析 JSON
                else if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
                  try {
                    extractedData = JSON.parse(result.choices[0].message.content);
                  } catch (e) {
                    console.error('Failed to parse content JSON:', e);
                  }
                }
                // 3. 尝试从 raw 字段获取
                else if (result.raw) {
                  try {
                    extractedData = JSON.parse(result.raw);
                  } catch (e) {
                    console.error('Failed to parse raw JSON:', e);
                  }
                }

                return extractedData ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 mb-2">提取的内容字段:</h4>
                    
                    {/* Title */}
                    {extractedData.title && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">📝 Title:</h5>
                        <p className="text-sm">{extractedData.title}</p>
                      </div>
                    )}

                    {/* Description */}
                    {extractedData.description && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">📄 Description:</h5>
                        <p className="text-sm">{extractedData.description}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {extractedData.tags && Array.isArray(extractedData.tags) && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">🏷️ Tags:</h5>
                        <div className="flex flex-wrap gap-2">
                          {extractedData.tags.map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* External Links/Packages */}
                    {extractedData.external_links && Array.isArray(extractedData.external_links) && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">📦 Packages/External Links:</h5>
                        <div className="space-y-1">
                          {extractedData.external_links.map((link: string, index: number) => (
                            <div key={index} className="text-xs font-mono bg-gray-100 p-2 rounded">
                              {link}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HTML */}
                    {extractedData.html && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">🌐 HTML:</h5>
                        <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-64">
                          <pre>{extractedData.html}</pre>
                        </div>
                      </div>
                    )}

                    {/* CSS */}
                    {extractedData.css && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">🎨 CSS:</h5>
                        <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-64">
                          <pre>{extractedData.css}</pre>
                        </div>
                      </div>
                    )}

                    {/* JavaScript */}
                    {extractedData.js && (
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-semibold text-blue-600 mb-2">⚡ JavaScript:</h5>
                        <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-auto max-h-64">
                          <pre>{extractedData.js}</pre>
                        </div>
                      </div>
                    )}

                    {/* Content Type & Language */}
                    <div className="grid grid-cols-2 gap-4">
                      {extractedData.content_type && (
                        <div className="bg-white p-3 rounded border">
                          <h5 className="font-semibold text-blue-600 mb-2">📋 Content Type:</h5>
                          <p className="text-sm">{extractedData.content_type}</p>
                        </div>
                      )}
                      {extractedData.language_code && (
                        <div className="bg-white p-3 rounded border">
                          <h5 className="font-semibold text-blue-600 mb-2">🌍 Language Code:</h5>
                          <p className="text-sm">{extractedData.language_code}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ 无法提取字段数据</h4>
                    <p className="text-yellow-700 text-sm">
                      请检查数据结构，可能需要调整数据提取逻辑。
                    </p>
                  </div>
                );
              })()}

              {/* 完整响应数据 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">完整响应数据:</h4>
                <div className="bg-white p-3 rounded border">
                  <pre className="text-xs overflow-auto max-h-96">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-semibold mb-2">使用说明:</h3>
          <ul className="text-yellow-700 space-y-1 text-sm">
            <li>• 选择上方的 Request ID 进行测试</li>
            <li>• "测试重新加载 API" 使用新的 /api/ai/reload 端点</li>
            <li>• "测试日志查询 API" 使用原有的 /api/ai/logs 端点</li>
            <li>• 如果查询成功，会显示完整的响应数据</li>
            <li>• 如果查询失败，会显示错误信息</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
