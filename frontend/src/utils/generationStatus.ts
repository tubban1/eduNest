// 生成状态管理工具函数

export const GENERATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  DONE: 'done',
  FAILED: 'failed'
} as const;

export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS];

// 文本截断工具函数
export const truncateUserQuery = (userQuery: string, maxLength: number = 12): string => {
  if (!userQuery) return '';
  if (userQuery.length <= maxLength) return userQuery;
  return userQuery.substring(0, maxLength) + '...';
};

// 状态到中文的映射
export const STATUS_LABELS: Record<GenerationStatus, string> = {
  [GENERATION_STATUS.PENDING]: '等待中',
  [GENERATION_STATUS.PROCESSING]: '生成中',
  [GENERATION_STATUS.DONE]: '已完成',
  [GENERATION_STATUS.FAILED]: '生成失败'
};

// 状态到英文的映射
export const STATUS_LABELS_EN: Record<GenerationStatus, string> = {
  [GENERATION_STATUS.PENDING]: 'Pending',
  [GENERATION_STATUS.PROCESSING]: 'Processing',
  [GENERATION_STATUS.DONE]: 'Completed',
  [GENERATION_STATUS.FAILED]: 'Failed'
};

// 状态到颜色的映射
export const STATUS_COLORS: Record<GenerationStatus, string> = {
  [GENERATION_STATUS.PENDING]: 'gray',
  [GENERATION_STATUS.PROCESSING]: 'blue',
  [GENERATION_STATUS.DONE]: 'green',
  [GENERATION_STATUS.FAILED]: 'red'
};

// 状态到图标的映射
export const STATUS_ICONS: Record<GenerationStatus, string> = {
  [GENERATION_STATUS.PENDING]: '⏳',
  [GENERATION_STATUS.PROCESSING]: '🔄',
  [GENERATION_STATUS.DONE]: '✅',
  [GENERATION_STATUS.FAILED]: '❌'
};

// 根据状态计算进度
export const getProgressByStatus = (status: GenerationStatus): number => {
  switch (status) {
    case GENERATION_STATUS.PENDING:
      return 10;
    case GENERATION_STATUS.PROCESSING:
      return 50;
    case GENERATION_STATUS.DONE:
      return 100;
    case GENERATION_STATUS.FAILED:
      return 0;
    default:
      return 0;
  }
};

// 判断是否为进行中状态
export const isGenerating = (status: GenerationStatus): boolean => {
  return status === GENERATION_STATUS.PENDING || status === GENERATION_STATUS.PROCESSING;
};

// 判断是否为最终状态
export const isFinalStatus = (status: GenerationStatus): boolean => {
  return status === GENERATION_STATUS.DONE || status === GENERATION_STATUS.FAILED;
};

// 判断是否可以重试
export const canRetry = (status: GenerationStatus): boolean => {
  return status === GENERATION_STATUS.FAILED;
};

// 获取状态标签（支持国际化）
export const getStatusLabel = (status: GenerationStatus, locale: string = 'zh'): string => {
  if (locale === 'en') {
    return STATUS_LABELS_EN[status] || status;
  }
  return STATUS_LABELS[status] || status;
};

// 获取状态颜色类名（Tailwind CSS）- 使用教育级配色方案
export const getStatusColorClass = (status: GenerationStatus, type: 'bg' | 'text' | 'border' = 'bg'): string => {
  const color = STATUS_COLORS[status];
  switch (color) {
    case 'gray':
      return type === 'bg' ? 'bg-muted' : type === 'text' ? 'text-muted-foreground' : 'border-border';
    case 'blue':
      // 使用 primary 颜色（低饱和蓝）
      return type === 'bg' ? 'bg-primary/10' : type === 'text' ? 'text-primary' : 'border-primary/20';
    case 'green':
      // 使用 secondary 颜色（柔和青绿）
      return type === 'bg' ? 'bg-secondary/10' : type === 'text' ? 'text-secondary' : 'border-secondary/20';
    case 'red':
      // 使用 destructive 颜色（错误反馈）
      return type === 'bg' ? 'bg-destructive/10' : type === 'text' ? 'text-destructive' : 'border-destructive/20';
    default:
      return type === 'bg' ? 'bg-muted' : type === 'text' ? 'text-muted-foreground' : 'border-border';
  }
};

// 生成状态接口定义
export interface GenerationStatusResponse {
  status: GenerationStatus;
  progress: number;
  retry_count: number;
  latest_request_id?: string;
  error_message?: string;
  user_query?: string;
  created_at?: string;
  updated_at?: string;
  started_at?: string;
}

// 内容接口扩展
export interface Content {
  id: string;
  title: string;
  description?: string;
  full_html?: string;
  tags?: string[];
  language_code: string;
  content_type: string;
  created_by?: string;
  visitor_id?: string; // 游客 ID（未登录用户创建的内容）
  created_at: string;
  updated_at: string;
  short_id: string;
  is_deleted?: boolean;
  deleted_at?: string;
  // 生成状态（通过关联查询获得）
  generation_status?: GenerationStatus;
  generation_progress?: number;
  retry_count?: number;
  generation_error?: string;
  // 缩略图相关字段
  thumbnail_url?: string;
  thumbnail_status?: 'pending' | 'generating' | 'ready' | 'failed';
  thumbnail_updated_at?: string;
}

// 批量状态查询结果
export interface BatchGenerationStatus {
  content_id: string;
  status: GenerationStatus | 'unknown' | 'unauthorized' | 'error';
  progress: number;
  retry_count: number;
  latest_request_id?: string;
  error_message?: string;
  error?: string;
  started_at?: string;
}

// 队列状态接口
export interface QueueStatus {
  pending: number;
  processing: number;
  done: number;
  failed: number;
  running_tasks: number;
  max_concurrent: number;
}

// 状态轮询配置（已根据6分钟超时限制调整）
export const POLLING_CONFIG = {
  // 渐进式轮询间隔（毫秒）- 调整为更快的间隔
  intervals: [20000, 10000, 5000, 2000], // 20s -> 10s -> 5s -> 2s
  // 默认轮询间隔（4次后使用）
  defaultInterval: 2000, // 2秒
  // 最大轮询次数 - 6分钟超时，平均间隔2秒，约180次
  maxAttempts: 180, // 6分钟
  // 轮询退避策略
  backoffMultiplier: 1.1,
  // 最大轮询间隔
  maxInterval: 10000
};

// 状态轮询管理器
export class StatusPollingManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: Map<string, (status: GenerationStatusResponse) => void> = new Map();
  private attemptCounts: Map<string, number> = new Map();
  // 轮询间隔状态持久化（用于页面刷新后恢复）
  private pollingIntervals: Map<string, number> = new Map();

  startPolling(
    contentId: string, 
    callback: (status: GenerationStatusResponse) => void,
    apiCall: (id: string) => Promise<{ success: boolean; data: GenerationStatusResponse }>,
    restoreAttemptCount?: number // 可选：恢复之前的尝试次数
  ) {
    // 如果已经在轮询，先停止
    this.stopPolling(contentId);

    // 设置回调
    this.callbacks.set(contentId, callback);
    // 如果提供了恢复的尝试次数，使用它；否则从 sessionStorage 恢复
    const savedAttemptCount = restoreAttemptCount ?? this.restoreAttemptCount(contentId);
    this.attemptCounts.set(contentId, savedAttemptCount);

    // 开始轮询
    const poll = async () => {
      try {
        const attemptCount = this.attemptCounts.get(contentId) || 0;
        
        // 检查是否超过最大尝试次数
        if (attemptCount >= POLLING_CONFIG.maxAttempts) {
          console.warn(`轮询超时: contentId=${contentId}, 尝试次数=${attemptCount}`);
          this.stopPolling(contentId);
          return;
        }

        const response = await apiCall(contentId);
        
        if (response.success) {
          // 重置连续失败计数
          this.attemptCounts.set(`failures_${contentId}`, 0);
          
          const status = response.data;
          
          // 调用回调
          const cb = this.callbacks.get(contentId);
          if (cb) {
            cb(status);
          }

          // 如果是最终状态，停止轮询
          if (isFinalStatus(status.status)) {
            this.stopPolling(contentId);
            return;
          }
        }

        // 增加尝试次数
        this.attemptCounts.set(contentId, attemptCount + 1);

        // 计算下次轮询间隔（渐进式策略）
        let interval: number;
        if (attemptCount < POLLING_CONFIG.intervals.length) {
          // 使用预定义的渐进式间隔
          interval = POLLING_CONFIG.intervals[attemptCount];
        } else {
          // 4次后使用默认间隔
          interval = POLLING_CONFIG.defaultInterval;
        }
        
        // 保存当前间隔到内存和 sessionStorage（用于页面刷新后恢复）
        this.pollingIntervals.set(contentId, interval);
        this.savePollingState(contentId, attemptCount, interval);

        // 设置下次轮询
        const timeoutId = setTimeout(poll, interval);
        this.intervals.set(contentId, timeoutId);

      } catch (error) {
        console.error(`轮询失败: contentId=${contentId}`, error);
        
        // 判断是否为网络错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = 
          error instanceof TypeError ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('网络连接') ||
          errorMessage.includes('请求超时') ||
          errorMessage.includes('timeout');
        
        // 网络错误不计入尝试次数，继续重试
        // 只有在连续失败多次后才考虑停止
        
        // 继续轮询（使用较短的间隔，尽快恢复）
        const currentAttemptCount = this.attemptCounts.get(contentId) || 0;
        
        // 网络错误使用较短的固定间隔，加快恢复速度
        const interval = 5000; // 5秒
        
        // 根据6分钟超时限制调整：6分钟 = 360秒，5秒间隔最多72次
        // 设置为60次（5分钟），留出1分钟缓冲，确保在任务超时前停止无意义的轮询
        const maxConsecutiveFailures = 60; // 60次 × 5秒 = 300秒（5分钟）
        const consecutiveFailures = this.attemptCounts.get(`failures_${contentId}`) || 0;
        
        // 在第一次失败或每10次失败时显示提示（避免频繁提示）
        if (consecutiveFailures === 0 || consecutiveFailures % 10 === 0) {
          // 动态导入 toast，确保只在客户端使用
          if (typeof window !== 'undefined') {
            import('./toast').then(({ toast }) => {
              if (isNetworkError) {
                // 检查是否离线
                const isOffline = 'navigator' in window && !navigator.onLine;
                if (isOffline) {
                  toast.warning('网络连接已断开，正在等待网络恢复...', 5000);
                } else {
                  toast.warning('网络连接不稳定，正在重试...', 3000);
                }
              } else {
                toast.error('获取生成状态失败，正在重试...', 3000);
              }
            }).catch(() => {
              // 静默处理导入失败
            });
          }
        }
        
        if (consecutiveFailures > maxConsecutiveFailures) {
          console.warn(`轮询连续失败次数过多（${consecutiveFailures}次），停止轮询: contentId=${contentId}。任务可能已超时（6分钟限制）`);
          if (typeof window !== 'undefined') {
            import('./toast').then(({ toast }) => {
              toast.error('网络连接持续失败，已停止轮询。请检查网络后刷新页面。', 5000);
            }).catch(() => {
              // 静默处理导入失败
            });
          }
          this.stopPolling(contentId);
          return;
        }
        
        // 增加连续失败计数
        this.attemptCounts.set(`failures_${contentId}`, consecutiveFailures + 1);
        
        const timeoutId = setTimeout(poll, interval);
        this.intervals.set(contentId, timeoutId);
      }
    };

    // 立即执行一次
    poll();
  }

  stopPolling(contentId: string) {
    const interval = this.intervals.get(contentId);
    if (interval) {
      clearTimeout(interval);
      this.intervals.delete(contentId);
    }
    
    this.callbacks.delete(contentId);
    this.attemptCounts.delete(contentId);
    this.pollingIntervals.delete(contentId);
    // 清理持久化状态
    this.clearPollingState(contentId);
  }

  // 保存轮询状态到 sessionStorage
  private savePollingState(contentId: string, attemptCount: number, interval: number) {
    try {
      if (typeof window !== 'undefined') {
        const key = `polling_${contentId}`;
        sessionStorage.setItem(key, JSON.stringify({
          attemptCount,
          interval,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      // sessionStorage 可能不可用，忽略错误
    }
  }

  // 从 sessionStorage 恢复尝试次数
  private restoreAttemptCount(contentId: string): number {
    try {
      if (typeof window !== 'undefined') {
        const key = `polling_${contentId}`;
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const state = JSON.parse(saved);
          // 如果保存的状态超过10分钟，认为已过期，重置为0
          if (Date.now() - state.timestamp < 10 * 60 * 1000) {
            return state.attemptCount || 0;
          }
        }
      }
    } catch (e) {
      // sessionStorage 可能不可用，忽略错误
    }
    return 0;
  }

  // 清理持久化状态
  private clearPollingState(contentId: string) {
    try {
      if (typeof window !== 'undefined') {
        const key = `polling_${contentId}`;
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      // sessionStorage 可能不可用，忽略错误
    }
  }

  stopAllPolling() {
    for (const [contentId] of this.intervals) {
      this.stopPolling(contentId);
    }
  }

  isPolling(contentId: string): boolean {
    return this.intervals.has(contentId);
  }

  getPollingCount(): number {
    return this.intervals.size;
  }
}

// 全局轮询管理器实例
export const statusPollingManager = new StatusPollingManager();

/**
 * SSE + 轮询混合状态管理器
 * 优先使用 SSE，失败时自动降级到轮询
 */
export class HybridStatusManager {
  private eventSource: EventSource | null = null;
  private pollingManager: StatusPollingManager;
  private contentId: string;
  private callback: (status: GenerationStatusResponse) => void;
  private apiCall: (id: string) => Promise<{ success: boolean; data: GenerationStatusResponse }>;
  private isActive: boolean = false;
  private visitorId: string | null = null;

  constructor(
    contentId: string,
    callback: (status: GenerationStatusResponse) => void,
    apiCall: (id: string) => Promise<{ success: boolean; data: GenerationStatusResponse }>,
    visitorId?: string | null
  ) {
    this.contentId = contentId;
    this.callback = callback;
    this.apiCall = apiCall;
    this.pollingManager = new StatusPollingManager();
    this.visitorId = visitorId || null;
  }

  start() {
    if (this.isActive) {
      return; // 已经在运行
    }

    this.isActive = true;

    // 如果没有 visitor_id，直接使用轮询（因为 SSE 无法传递 Authorization header）
    // 轮询可以通过 api.getContentGenerationStatus 传递 Authorization header（如果用户已登录）
    // 或者传递 X-Visitor-Id header（如果用户未登录）
    if (!this.visitorId) {
      this.startFallbackPolling();
      return;
    }

    // 优先尝试 SSE（仅当有 visitor_id 时）
    if (typeof EventSource !== 'undefined') {
      try {
        this.startSSE();
      } catch (e) {
        console.warn('SSE 不可用，降级到轮询:', e);
        this.startFallbackPolling();
      }
    } else {
      // 浏览器不支持 SSE，直接使用轮询
      console.warn('浏览器不支持 EventSource，使用轮询');
      this.startFallbackPolling();
    }
  }

  private startSSE() {
    // 获取 API base URL
    const baseUrl = typeof window !== 'undefined' 
      ? (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api')
      : 'http://localhost:3001/api';
    
    let url = `${baseUrl}/ai/generation-status-stream/${this.contentId}`;

    // 添加 visitor_id 作为 URL 参数（因为 EventSource 不支持自定义 headers）
    if (this.visitorId) {
      url += `?visitor_id=${encodeURIComponent(this.visitorId)}`;
    }

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          return;
        }

        if (data.type === 'status') {
          // 转换 SSE 数据格式为 GenerationStatusResponse
          const statusData: GenerationStatusResponse = {
            status: data.status,
            progress: data.progress || 0,
            retry_count: data.retry_count || 0,
            latest_request_id: data.latest_request_id,
            error_message: data.error_message,
            user_query: data.user_query,
            created_at: data.created_at,
            updated_at: data.updated_at,
            started_at: data.started_at
          };

          this.callback(statusData);

          // 如果是最终状态，停止
          if (isFinalStatus(statusData.status)) {
            this.stop();
          }
        }

        if (data.type === 'complete') {
          this.stop();
        }
      } catch (e) {
        console.error('[SSE] 解析消息失败:', e, event.data);
      }
    };

    this.eventSource.addEventListener('error', (event: any) => {
      console.warn(`[SSE] 错误事件: contentId=${this.contentId}`, event);
      // SSE 连接失败，降级到轮询
      this.fallbackToPolling();
    });

    this.eventSource.onerror = () => {
      console.warn(`[SSE] 连接错误，降级到轮询: contentId=${this.contentId}`);
      this.fallbackToPolling();
    };
  }

  private fallbackToPolling() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.startFallbackPolling();
  }

  private startFallbackPolling() {
    // 创建一个包装的 apiCall，确保传递 visitor_id
    const wrappedApiCall = async (contentId: string) => {
      // 如果 apiCall 支持传递 visitor_id，使用它
      // 否则，我们需要手动添加 visitor_id header
      if (this.visitorId) {
        // 创建一个新的 API 调用，包含 visitor_id header
        const baseUrl = typeof window !== 'undefined' 
          ? (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api')
          : 'http://localhost:3001/api';
        
        const url = `${baseUrl}/ai/generation-status/${contentId}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Visitor-Id': this.visitorId,
        };
        
        // 如果用户已登录，也需要添加 Authorization header
        // 因为后端需要同时验证 user_id 和 visitor_id
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        } catch (e) {
          // 静默处理，如果无法获取 token，继续使用 visitor_id
        }
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers,
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`[轮询] 请求失败: status=${response.status}, error=`, errorData);
            throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          return data;
        } catch (error: any) {
          console.error('[轮询] API调用失败:', error);
          throw error;
        }
      } else {
        // 如果没有 visitor_id，使用原始的 apiCall
        // api.getContentGenerationStatus 会自动添加 Authorization header（如果用户已登录）
        return this.apiCall(contentId);
      }
    };
    
    this.pollingManager.startPolling(
      this.contentId,
      this.callback,
      wrappedApiCall
    );
  }

  stop() {
    this.isActive = false;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.pollingManager.stopPolling(this.contentId);
  }

  isRunning(): boolean {
    return this.isActive;
  }
}
