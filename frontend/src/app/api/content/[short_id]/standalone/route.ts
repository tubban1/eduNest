import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { generateStandaloneContentPage } from '@/utils/contentPageGenerator';

export async function GET(
  request: NextRequest,
  { params }: { params: { short_id: string } }
) {
  try {
    const shortId = params.short_id;
    
    // 获取内容数据
    const content = await api.content.getByShortId(shortId);
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    // 生成独立页面HTML
    const pageData = {
      html: content.code_html,
      css: content.code_css,
      js: content.code_js,
      externalLinks: content.external_links,
      title: content.title || 'Interactive Content',
      description: content.description || 'AI Generated Interactive Content',
      keywords: 'interactive, content, ai, education',
      author: 'AI Education Platform'
    };
    
    const html = generateStandaloneContentPage(pageData);
    
    // 返回HTML页面
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1小时缓存
      },
    });
  } catch (error) {
    console.error('Error generating standalone page:', error);
    return NextResponse.json(
      { error: 'Failed to generate standalone page' },
      { status: 500 }
    );
  }
} 