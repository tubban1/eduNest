import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3001/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { short_id: string } }
) {
  try {
    const shortId = params.short_id;

    // 直接调用后端 API，避免使用包含 React 依赖的 api 客户端
    const response = await fetch(`${API_BASE_URL}/content/short/${encodeURIComponent(shortId)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: response.status }
      );
    }

    const result = await response.json();
    const content = result?.data;

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // 直接返回 full_html，如果没有则返回错误
    if (!content.full_html) {
      return NextResponse.json({ error: 'Content does not have full_html' }, { status: 404 });
    }

    return new NextResponse(content.full_html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
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


