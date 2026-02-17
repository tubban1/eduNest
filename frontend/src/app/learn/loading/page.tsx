'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AiLoadingAnimation from '@/components/AiLoadingAnimation';

function LearnLoadingContent() {
  const searchParams = useSearchParams();
  const kp = searchParams.get('kp') || '';

  return (
    <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <AiLoadingAnimation isActive={true} knowledgePoint={kp} />
    </div>
  );
}

/**
 * 供 learn 页 iframe 在「生成新内容」时使用，不请求任何 content 接口。
 * 仅展示 AiLoadingAnimation，生成结束后父页会切换 iframe src 到新内容。
 */
export default function LearnLoadingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
          <AiLoadingAnimation isActive={true} knowledgePoint="" />
        </div>
      }
    >
      <LearnLoadingContent />
    </Suspense>
  );
}
