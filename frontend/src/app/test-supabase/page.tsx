'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabase() {
  const [status, setStatus] = useState<string>('检查中...');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        setStatus('测试Supabase连接...');
        
        // 测试基本连接
        const { data, error } = await supabase.from('content').select('count').limit(1);
        
        if (error) {
          setError(`连接错误: ${error.message}`);
          setStatus('连接失败');
        } else {
          setStatus('连接成功！');
        }
      } catch (err: any) {
        setError(`错误: ${err.message}`);
        setStatus('连接失败');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Supabase 连接测试</h1>
        
        <div className="space-y-4">
          <div>
            <strong>状态:</strong> {status}
          </div>
          
          {error && (
            <div className="text-red-600 bg-red-50 p-3 rounded">
              <strong>错误:</strong> {error}
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            <div><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || '未设置'}</div>
            <div><strong>Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置'}</div>
          </div>
        </div>
      </div>
    </div>
  );
} 