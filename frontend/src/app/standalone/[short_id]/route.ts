import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { short_id: string } }
) {
  try {
    const shortId = params.short_id;

    const content = await api.content.getByShortId(shortId);
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


