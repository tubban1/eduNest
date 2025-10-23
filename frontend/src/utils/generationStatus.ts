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

// 获取状态颜色类名（Tailwind CSS）
export const getStatusColorClass = (status: GenerationStatus, type: 'bg' | 'text' | 'border' = 'bg'): string => {
  const color = STATUS_COLORS[status];
  switch (color) {
    case 'gray':
      return type === 'bg' ? 'bg-gray-100' : type === 'text' ? 'text-gray-600' : 'border-gray-200';
    case 'blue':
      return type === 'bg' ? 'bg-blue-100' : type === 'text' ? 'text-blue-600' : 'border-blue-200';
    case 'green':
      return type === 'bg' ? 'bg-green-100' : type === 'text' ? 'text-green-600' : 'border-green-200';
    case 'red':
      return type === 'bg' ? 'bg-red-100' : type === 'text' ? 'text-red-600' : 'border-red-200';
    default:
      return type === 'bg' ? 'bg-gray-100' : type === 'text' ? 'text-gray-600' : 'border-gray-200';
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
  code_html?: string;
  code_css?: string;
  code_js?: string;
  external_links?: string[];
  tags?: string[];
  language_code: string;
  content_type: string;
  created_by?: string;
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

// 状态轮询配置
export const POLLING_CONFIG = {
  // 轮询间隔（毫秒）
  interval: 2000,
  // 最大轮询次数
  maxAttempts: 300, // 10分钟
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

  startPolling(
    contentId: string, 
    callback: (status: GenerationStatusResponse) => void,
    apiCall: (id: string) => Promise<{ success: boolean; data: GenerationStatusResponse }>
  ) {
    // 如果已经在轮询，先停止
    this.stopPolling(contentId);

    // 设置回调
    this.callbacks.set(contentId, callback);
    this.attemptCounts.set(contentId, 0);

    // 开始轮询
    const poll = async () => {
      try {
        const attemptCount = this.attemptCounts.get(contentId) || 0;
        
        // 检查是否超过最大尝试次数
        if (attemptCount >= POLLING_CONFIG.maxAttempts) {
          console.warn(`轮询超时: contentId=${contentId}`);
          this.stopPolling(contentId);
          return;
        }

        const response = await apiCall(contentId);
        
        if (response.success) {
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

        // 计算下次轮询间隔（退避策略）
        const interval = Math.min(
          POLLING_CONFIG.interval * Math.pow(POLLING_CONFIG.backoffMultiplier, attemptCount),
          POLLING_CONFIG.maxInterval
        );

        // 设置下次轮询
        const timeoutId = setTimeout(poll, interval);
        this.intervals.set(contentId, timeoutId);

      } catch (error) {
        console.error(`轮询失败: contentId=${contentId}`, error);
        
        // 增加尝试次数
        const attemptCount = this.attemptCounts.get(contentId) || 0;
        this.attemptCounts.set(contentId, attemptCount + 1);

        // 如果超过最大尝试次数，停止轮询
        if (attemptCount >= POLLING_CONFIG.maxAttempts) {
          this.stopPolling(contentId);
          return;
        }

        // 继续轮询
        const timeoutId = setTimeout(poll, POLLING_CONFIG.interval);
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
