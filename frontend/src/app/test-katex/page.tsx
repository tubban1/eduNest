'use client';

import React from 'react';
import AIGuideMessageRenderer from '@/components/AIGuideMessageRenderer';

const samples = [
  {
    id: 'inline',
    title: '行内公式',
    md: '你好！欢迎来到 eduNest 几何实验室。我是你的学习伙伴。今天我们将一起探索一个结合了圆几何性质与三角函数的综合问题。\n\n通过这个交互练习，你将掌握如何灵活运用**圆周角定理**、**正弦定理**，以及如何通过**三角恒等变换**来解决复杂的几何线段求解问题。\n\n目前我们处于**第一阶段：题目回顾**。已知条件是直径 $AB=4$ 以及 $\\angle AEO=45^\\circ$。你可以先观察一下画布上的初始图形，圆 O 和直径 AB 已经标出。\n\n准备好了吗？点击下方的**“下一步”**，我们来看看如何利用“直径所对的圆周角”这个性质来迈出解题的第一步。'
  },
  {
    id: 'block',
    title: '块级公式',
    md: '$$\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$'
  },
  {
    id: 'alt',
    title: '替代语法',
    md: '行内 \\(a^2+b^2=c^2\\) 与块级 \\[\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\\]'
  },
  {
    id: 'mixed',
    title: '混合内容',
    md: `以下是二次方程求根公式：
$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
其中判别式 $\\Delta = b^2 - 4ac$ 决定根的性质。`
  }
];

export default function TestKaTeX() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">KaTeX 渲染验证</h1>
      {samples.map((s) => (
        <section key={s.id} className="border rounded p-4">
          <h2 className="font-semibold mb-2">{s.title}</h2>
          <pre className="bg-gray-100 text-sm p-2 rounded mb-2">{s.md}</pre>
          <div className="bg-blue-50 p-3 rounded">
            <AIGuideMessageRenderer content={s.md} messageId={s.id} />
          </div>
        </section>
      ))}
    </div>
  );
}