"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { getInitContext, getAgeFromContext } from '@/utils/initContext';

export default function ParentAdvicePage() {
  const { user } = useAuth();
  const [expectations, setExpectations] = useState('');
  const [childInterests, setChildInterests] = useState('');
  const [childTalents, setChildTalents] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAdvice(null);

    try {
      const init = getInitContext();
      const payload = {
        identity: 'parent',
        region: init?.region || null,
        language: init?.language || 'zh-CN',
        age: getAgeFromContext(init ?? null),
        subjects: init?.subjects || [],
        expectations: expectations || null,
        child_interests: childInterests || null,
        child_talents: childTalents || null,
      };

      const res = await api.post('/parent/advice', payload);
      if (!res?.success || !res.data?.advice) {
        throw new Error(res?.message || res?.error || '生成建议失败');
      }
      setAdvice(res.data.advice);
    } catch (err: any) {
      setError(err?.message || '生成建议失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const title = user ? `家长建议（${user.email}）` : '家长建议';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        根据你的期待、孩子的兴趣和天赋，AI 会给出一段个性化学习建议。当前会尽量利用初始化时的年龄 / 区域 / 科目信息。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">你的期待（可选）</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
            placeholder="例如：希望数学稳在班级前几，希望 TA 能养成先复盘再做题的习惯……"
            value={expectations}
            onChange={(e) => setExpectations(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">孩子的兴趣（可选）</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
            placeholder="例如：喜欢科学实验、搭乐高、看科幻动画……"
            value={childInterests}
            onChange={(e) => setChildInterests(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">孩子的天赋 / 特长（可选）</label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
            placeholder="例如：逻辑思维好、表达能力强、动手能力强、记忆力好……"
            value={childTalents}
            onChange={(e) => setChildTalents(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {loading ? '生成中…' : '生成 AI 建议'}
        </button>

        {error && (
          <p className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </form>

      {advice && (
        <div className="mt-8 border rounded-md p-4 bg-gray-50 whitespace-pre-wrap text-sm leading-relaxed">
          {advice}
        </div>
      )}
    </div>
  );
}

