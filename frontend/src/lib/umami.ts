// Umami 分析配置
const UMANI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMANI_URL = process.env.NEXT_PUBLIC_UMAMI_URL;

// 检查配置
if (!UMANI_WEBSITE_ID || !UMANI_URL) {
  // 静默处理配置缺失
}

// 跟踪页面访问
export const trackPageView = (url: string) => {
  if (!UMANI_WEBSITE_ID || !UMANI_URL) {
    return;
  }

  try {
    fetch(`${UMANI_URL}/api/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'pageview',
        payload: {
          website: UMANI_WEBSITE_ID,
          url: url,
          referrer: document.referrer,
        },
      }),
    }).catch(() => {
      // 静默处理错误
    });
  } catch (error) {
    // 静默处理错误
  }
};

// 跟踪自定义事件
export const trackEvent = (eventName: string, eventData?: any) => {
  if (!UMANI_WEBSITE_ID || !UMANI_URL) {
    return;
  }

  try {
    fetch(`${UMANI_URL}/api/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: UMANI_WEBSITE_ID,
          url: window.location.href,
          event_name: eventName,
          event_data: eventData,
        },
      }),
    }).catch(() => {
      // 静默处理错误
    });
  } catch (error) {
    // 静默处理错误
  }
};

export const trackContentView = (contentId: string, contentTitle: string) => {
  trackEvent('content_view', { contentId, contentTitle })
}

export const trackContentRate = (contentId: string, rating: number) => {
  trackEvent('content_rate', { contentId, rating })
}

export const trackContentShare = (contentId: string, platform: string) => {
  trackEvent('content_share', { contentId, platform })
}

export const trackContentCollect = (contentId: string, listPath: string) => {
  trackEvent('content_collect', { contentId, listPath })
} 