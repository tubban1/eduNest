'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkError } from '@/hooks/useNetworkError';
import { api } from '@/lib/api';
import AIProviderSelector from '@/components/AIProviderSelector';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';
import { getVisitorId } from '@/utils/visitorId';
import { RegistrationPrompt } from '@/components/RegistrationPrompt';
import StarfieldBackground from '@/components/StarfieldBackground';
import i18n from '@/i18n/config';

const DEFAULT_FULL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新内容（Web Components 示例）</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 24px;
      background: #020617;
      color: #e5e7eb;
    }
    my-lesson-root {
      display: block;
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
      border-radius: 16px;
      background: radial-gradient(circle at top left, rgba(59,130,246,0.25), transparent 55%),
                  radial-gradient(circle at bottom right, rgba(236,72,153,0.18), transparent 55%),
                  #020617;
      box-shadow: 0 22px 45px rgba(15,23,42,0.9);
    }
  </style>
</head>
<body>
  <my-lesson-root></my-lesson-root>
  <script>
    class MyLessonRoot extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
      connectedCallback() {
        this.render();
      }
      render() {
        if (!this.shadowRoot) return;
        this.shadowRoot.innerHTML = \`
          <style>
            :host { color: #e5e7eb; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            h1 { font-size: 1.4rem; margin: 0 0 0.75rem; }
            p { margin: 0.4rem 0; line-height: 1.6; }
            button {
              margin-top: 0.75rem;
              border-radius: 9999px;
              padding: 0.4rem 0.9rem;
              border: none;
              cursor: pointer;
              background: linear-gradient(135deg, #4f46e5, #22c55e);
              color: white;
              font-size: 0.85rem;
            }
          </style>
          <h1>Web Components 入门示例</h1>
          <p>这是一个使用原生 Web Components 构建的最小教学内容示例。</p>
          <p>你可以在 AI 生成的内容中，将这里替换为真正的交互式教具。</p>
          <button id="btn">点击这里，不会发生任何错误</button>
        \`;
        const btn = this.shadowRoot.getElementById('btn');
        if (btn) {
          btn.addEventListener('click', () => {
            alert('可以在这里触发教学相关的交互逻辑');
          });
        }
      }
    }
    customElements.define('my-lesson-root', MyLessonRoot);
  </script>
</body>
</html>`;

interface ContentAIGeneratorProps {
  className?: string;
  onGenerated?: () => void;
  defaultLanguageCode?: string;
}

export default function ContentAIGenerator({
  className,
  onGenerated,
  defaultLanguageCode,
}: ContentAIGeneratorProps) {
  const { t } = useTranslation(['content', 'common', 'aiProvider', 'auth']);
  const { user } = useAuth();
  const { handleNetworkError } = useNetworkError();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // 输入与状态
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [outputType, setOutputType] = useState<'interactive' | 'animated'>('interactive');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [trialStatus, setTrialStatus] = useState<{ content_generated: boolean; ai_guide_used: boolean } | null>(null);
  // 图片上传相关状态
  const [uploadedImage, setUploadedImage] = useState<{ file: File; dataUrl: string; base64: string; mimeType: string } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // 语言弹窗
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  
  // 示例提示词轮播状态
  const [examplePromptIndex, setExamplePromptIndex] = useState(0);
  // 上传提示文字显示状态
  const [showUploadHint, setShowUploadHint] = useState(false);
  // 移动端降级：桌面端(>=lg)显示星空粒子，移动端使用静态背景
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop('matches' in e ? e.matches : (e as MediaQueryList).matches);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  // 上传提示文字动画：页面加载后淡入，停留10秒，然后淡出
  useEffect(() => {
    if (!mounted) return;
    // 延迟一点显示，让页面先渲染
    const showTimer = setTimeout(() => {
      setShowUploadHint(true);
    }, 500);
    
    // 10秒后淡出
    const hideTimer = setTimeout(() => {
      setShowUploadHint(false);
    }, 10500);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [mounted]);

  // 示例提示词轮播（只在知识点为空时运行）
  useEffect(() => {
    if (knowledgePoint.trim() || !mounted) {
      return;
    }

    const examples = t('knowledgePointExamples', { ns: 'content', returnObjects: true }) as string[];
    if (!Array.isArray(examples) || examples.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setExamplePromptIndex(prev => (prev + 1) % examples.length);
    }, 5000); // 每 3 秒切换一次

    return () => clearInterval(interval);
  }, [knowledgePoint, mounted, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 游客状态：使用系统语言，如果不在支持列表中则使用英语
    if (!user) {
      // 获取系统语言（从 i18n 或 navigator）
      const systemLang = i18n.language || navigator.language || 'en-US';
      // 标准化语言代码（zh -> zh-CN, en -> en-US 等）
      const normalizedSystemLang = systemLang === 'zh' || systemLang.startsWith('zh-') ? 'zh-CN' :
                                   systemLang === 'en' || systemLang.startsWith('en-') ? 'en-US' :
                                   systemLang === 'de' || systemLang.startsWith('de-') ? 'de-DE' :
                                   systemLang === 'fr' || systemLang.startsWith('fr-') ? 'fr-FR' :
                                   systemLang;
      
      // 检查系统语言是否在支持列表中
      const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === normalizedSystemLang);
      const initial = isSupported ? normalizedSystemLang : 'en-US';
      setLanguage(initial);
      return;
    }
    
    // 已登录用户：使用原有逻辑（defaultLanguageCode > localStorage > zh-CN）
    const fromStorage = localStorage.getItem('output_language_last_used') || '';
    const initial = defaultLanguageCode || fromStorage || 'zh-CN';
    setLanguage(initial);
  }, [defaultLanguageCode, user]);

  // 拉取用户可用积分与当前待处理任务数
  const fetchPrecheckInfo = async () => {
    if (!user) return;
    try {
      setChecking(true);
      // 1) 获取积分
      const creditRes = await api.get('/credits/balance');
      const balance = (creditRes as any)?.success ? (creditRes as any)?.data?.balance : (creditRes as any)?.data?.balance ?? (creditRes as any)?.balance;
      if (typeof balance === 'number') setCreditsBalance(balance);
      // 2) 获取当前用户未完成的生成任务数量
      const myList: any[] = await api.content.getFiltered({ created_by: user.id } as any);
      const count = Array.isArray(myList) ? myList.filter((c: any) => ['pending', 'processing'].includes((c as any).generation_status)).length : 0;
      setPendingCount(count);
    } catch (e) {
      // 静默失败
    } finally {
      setChecking(false);
    }
  };

  // 检查免费试用状态（未登录用户）
  const fetchTrialStatus = async () => {
    if (user) return; // 已登录用户不需要检查
    try {
      const status = await api.visitor.checkTrial();
      if (status.success && status.data) {
        setTrialStatus(status.data);
        // 如果试用已用完，显示注册提示
        if (status.data.content_generated) {
          setShowRegistrationPrompt(true);
        }
      }
    } catch (e) {
      // 静默失败
    }
  };

  useEffect(() => {
    if (user) {
      fetchPrecheckInfo();
    } else {
      fetchTrialStatus();
    }
  }, [user]);

  useEffect(() => {
    const onVisible = () => { 
      if (document.visibilityState === 'visible') {
        if (user) {
          fetchPrecheckInfo();
        } else {
          fetchTrialStatus();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user]);

  const isRegularUser = user && user.role !== 'admin';
  // 所有用户统一允许 10000 字（后端已放宽）
  const maxKnowledgeLength = 10000;
  const isAiFormDisabled = aiGenerating === true;

  // 选择语言
  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('output_language_last_used', code);
    }
    setShowLanguagePicker(false);
    setLanguageSearch('');
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(l => {
    const kw = languageSearch.trim().toLowerCase();
    if (!kw) return true;
    return l.code.toLowerCase().includes(kw) || (l.label || '').toLowerCase().includes(kw);
  });

  // 根据语言代码获取标签显示（中文、English、Deutsch、Français）
  const getLanguageLabel = (code: string): string => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
    return lang?.label || code;
  };

  // 智能压缩图片到目标大小（Vercel限制4.5MB，我们设置为4MB以确保安全）
  const compressImage = (file: File, targetSizeMB: number = 4): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const targetSizeBytes = targetSizeMB * 1024 * 1024;
          const originalWidth = img.width;
          const originalHeight = img.height;
          
          // 初始最大尺寸
          let maxDimension = 2048;
          let quality = 0.8;
          
          // 如果是PNG/GIF，转换为JPEG以减小体积
          let outputMimeType = file.type;
          if (file.type === 'image/png' || file.type === 'image/gif') {
            outputMimeType = 'image/jpeg';
          }

          // 使用循环而不是递归，逐步降低质量直到达到目标大小
          let dataUrl = '';
          let currentQuality = quality;
          
          while (currentQuality >= 0.1) {
            // 计算新尺寸（保持宽高比）
            let newWidth = originalWidth;
            let newHeight = originalHeight;
            
            if (newWidth > maxDimension || newHeight > maxDimension) {
              const ratio = Math.min(maxDimension / newWidth, maxDimension / newHeight);
              newWidth = Math.floor(newWidth * ratio);
              newHeight = Math.floor(newHeight * ratio);
            }

            // 创建 canvas 并绘制压缩后的图片
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('无法创建 canvas 上下文'));
              return;
            }

            // 绘制图片
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // 转换为 base64
            dataUrl = canvas.toDataURL(outputMimeType, currentQuality);
            
            // 计算实际大小（base64编码会增加约33%）
            const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              const base64Data = base64Match[1];
              const actualSize = (base64Data.length * 3) / 4;
              
              // 如果达到目标大小或质量已降到最低，返回结果
              if (actualSize <= targetSizeBytes) {
                resolve(dataUrl);
                return;
              }
            }
            
            // 降低质量重试
            currentQuality = Math.max(0.1, currentQuality - 0.1);
          }
          
          // 如果循环结束还没有达到目标大小，返回最后一次压缩的结果
          resolve(dataUrl);
        };
        img.onerror = () => {
          reject(new Error('图片加载失败'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };
      reader.readAsDataURL(file);
    });
  };

  // 处理文件（公共逻辑）
  const processImageFile = async (file: File, resetInput?: () => void) => {
    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(t('errors.invalidImageType', { ns: 'content', defaultValue: '不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP' }));
      if (resetInput) resetInput();
      return;
    }

    // 验证文件大小（最大 20MB，压缩后应该会小很多）
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setError(t('errors.imageTooLarge', { ns: 'content', defaultValue: '图片大小不能超过 20MB' }));
      if (resetInput) resetInput();
      return;
    }

    setImageUploading(true);
    setError('');

    try {
      // 压缩图片并转换为 base64（压缩到4MB以下以符合Vercel限制）
      const dataUrl = await compressImage(file, 4);
      
      // dataUrl 格式: data:image/png;base64,iVBORw0KGgo...
      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64 = base64Match[2];
        
        // 检查压缩后的 base64 大小（base64 编码会增加约 33% 的大小）
        const base64Size = (base64.length * 3) / 4; // 估算原始字节大小
        const maxSize = 4 * 1024 * 1024; // 4MB (Vercel限制是4.5MB，我们设置为4MB以确保安全)
        if (base64Size > maxSize) {
          setError(t('errors.imageTooLarge', { ns: 'content', defaultValue: '图片太大，请使用更小的图片或降低分辨率' }));
          setImageUploading(false);
          if (resetInput) resetInput();
          return;
        }

        setUploadedImage({
          file,
          dataUrl,
          base64,
          mimeType
        });
      } else {
        setError(t('errors.imageReadFailed', { ns: 'content', defaultValue: '图片读取失败' }));
      }
      setImageUploading(false);
      if (resetInput) resetInput();
    } catch (e: any) {
      setError(e.message || t('errors.imageReadFailed', { ns: 'content', defaultValue: '图片处理失败' }));
      setImageUploading(false);
      if (resetInput) resetInput();
    }
  };

  // 处理图片选择
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // 如果没有选择文件，重置输入框以便可以再次选择
      event.target.value = '';
      return;
    }

    processImageFile(file, () => {
      event.target.value = '';
    });
  };

  // 图片裁剪和旋转相关状态
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFlipH, setImageFlipH] = useState(false);
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragType, setDragType] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null); // 拖动类型：移动、西北角、东北角、西南角、东南角
  const [cropMode, setCropMode] = useState(false);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const imageContainerRef = React.useRef<HTMLDivElement>(null);

  // 打开图片编辑器
  const handleEditImage = () => {
    setShowImageEditor(true);
    setImageRotation(0);
    setImageFlipH(false);
    setCropArea(null);
    setCropMode(false);
  };

  // 关闭图片编辑器
  const handleCloseImageEditor = () => {
    setShowImageEditor(false);
    setImageRotation(0);
    setImageFlipH(false);
    setCropArea(null);
    setCropMode(false);
    setIsDragging(false);
    setDragStart(null);
  };

  // 旋转图片
  const handleRotateImage = (degrees: number) => {
    setImageRotation((prev) => (prev + degrees) % 360);
    setCropArea(null);
  };

  // 水平翻转图片
  const handleFlipImage = () => {
    setImageFlipH((prev) => !prev);
    setCropArea(null);
  };

  // 开始裁剪（进入裁剪模式）
  const handleStartCrop = () => {
    setCropMode(true);
    // 初始化裁剪区域为图片的80%大小，居中显示
    if (imageRef.current && imageContainerRef.current) {
      const img = imageRef.current;
      const container = imageContainerRef.current;
      const imgRect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // 获取图片的实际显示尺寸（不受旋转影响）
      const imgDisplayWidth = img.clientWidth || imgRect.width;
      const imgDisplayHeight = img.clientHeight || imgRect.height;
      
      // 计算图片在容器中的实际显示位置（考虑旋转）
      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;
      const imgDisplayX = imgCenterX - containerRect.left - imgDisplayWidth / 2;
      const imgDisplayY = imgCenterY - containerRect.top - imgDisplayHeight / 2;
      
      const cropWidth = imgDisplayWidth * 0.8;
      const cropHeight = imgDisplayHeight * 0.8;
      const cropX = imgDisplayX + (imgDisplayWidth - cropWidth) / 2;
      const cropY = imgDisplayY + (imgDisplayHeight - cropHeight) / 2;
      
      setCropArea({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      });
    }
  };

  // 取消裁剪
  const handleCancelCrop = () => {
    setCropMode(false);
    setCropArea(null);
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
  };

  // 获取相对于容器的坐标（支持鼠标和触摸）
  const getRelativeCoordinates = (clientX: number, clientY: number) => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // 检测点击的是哪个角或区域
  const detectDragType = (x: number, y: number, cropArea: { x: number; y: number; width: number; height: number }): 'move' | 'nw' | 'ne' | 'sw' | 'se' | null => {
    const handleSize = 20; // 角的大小
    const { x: cx, y: cy, width, height } = cropArea;
    
    // 检测四个角
    if (Math.abs(x - cx) < handleSize && Math.abs(y - cy) < handleSize) return 'nw'; // 西北角
    if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - cy) < handleSize) return 'ne'; // 东北角
    if (Math.abs(x - cx) < handleSize && Math.abs(y - (cy + height)) < handleSize) return 'sw'; // 西南角
    if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - (cy + height)) < handleSize) return 'se'; // 东南角
    
    // 检测是否在裁剪区域内（移动）
    if (x >= cx && x <= cx + width && y >= cy && y <= cy + height) return 'move';
    
    return null;
  };

  // 更新裁剪区域（根据拖动类型）
  const updateCropArea = (currentX: number, currentY: number, startCoords: { x: number; y: number }, dragType: string, initialCropArea: { x: number; y: number; width: number; height: number }) => {
    if (!imageRef.current || !imageContainerRef.current) return;
    
    const img = imageRef.current;
    const container = imageContainerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 获取图片的实际显示尺寸（考虑 object-contain 的缩放）
    // 当图片使用 object-contain 时，图片会保持原始宽高比
    const elementWidth = imgRect.width;
    const elementHeight = imgRect.height;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    // 计算图片的原始宽高比
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = elementWidth / elementHeight;
    
    // 根据 object-contain 的逻辑计算实际显示尺寸
    let imgDisplayWidth: number;
    let imgDisplayHeight: number;
    
    if (imageAspectRatio > containerAspectRatio) {
      // 图片更宽，按宽度适配
      imgDisplayWidth = elementWidth;
      imgDisplayHeight = elementWidth / imageAspectRatio;
    } else {
      // 图片更高，按高度适配
      imgDisplayWidth = elementHeight * imageAspectRatio;
      imgDisplayHeight = elementHeight;
    }
    
    // 计算图片在容器中的实际显示位置
    // 当图片使用 object-contain 时，图片内容在元素中是居中的
    let imgDisplayX: number;
    let imgDisplayY: number;
    
    // 检查图片是否有旋转
    const hasRotation = imageRotation !== 0;
    
    if (!hasRotation) {
      // 没有旋转时，需要考虑 object-contain 的居中效果
      // imgRect 是图片元素的边界框，imgDisplayWidth/Height 是图片内容的实际尺寸
      const elementWidth = imgRect.width;
      const elementHeight = imgRect.height;
      const contentOffsetX = (elementWidth - imgDisplayWidth) / 2;
      const contentOffsetY = (elementHeight - imgDisplayHeight) / 2;
      
      imgDisplayX = (imgRect.left - containerRect.left) + contentOffsetX;
      imgDisplayY = (imgRect.top - containerRect.top) + contentOffsetY;
    } else {
      // 有旋转时，通过中心点计算
      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;
      imgDisplayX = imgCenterX - containerRect.left - imgDisplayWidth / 2;
      imgDisplayY = imgCenterY - containerRect.top - imgDisplayHeight / 2;
    }
    
    // 限制坐标在图片范围内
    const minX = imgDisplayX;
    const maxX = imgDisplayX + imgDisplayWidth;
    const minY = imgDisplayY;
    const maxY = imgDisplayY + imgDisplayHeight;
    
    const deltaX = currentX - startCoords.x;
    const deltaY = currentY - startCoords.y;
    
    let newCropArea = { ...initialCropArea };
    const minSize = 50; // 最小裁剪尺寸
    
    switch (dragType) {
      case 'move':
        // 移动整个裁剪区域
        newCropArea.x = Math.max(minX, Math.min(maxX - newCropArea.width, initialCropArea.x + deltaX));
        newCropArea.y = Math.max(minY, Math.min(maxY - newCropArea.height, initialCropArea.y + deltaY));
        break;
      case 'nw':
        // 拖动西北角（左上角）
        newCropArea.x = Math.max(minX, Math.min(initialCropArea.x + initialCropArea.width - minSize, initialCropArea.x + deltaX));
        newCropArea.y = Math.max(minY, Math.min(initialCropArea.y + initialCropArea.height - minSize, initialCropArea.y + deltaY));
        newCropArea.width = (initialCropArea.x + initialCropArea.width) - newCropArea.x;
        newCropArea.height = (initialCropArea.y + initialCropArea.height) - newCropArea.y;
        // 确保最小尺寸
        if (newCropArea.width < minSize) {
          newCropArea.width = minSize;
          newCropArea.x = (initialCropArea.x + initialCropArea.width) - minSize;
        }
        if (newCropArea.height < minSize) {
          newCropArea.height = minSize;
          newCropArea.y = (initialCropArea.y + initialCropArea.height) - minSize;
        }
        break;
      case 'ne':
        // 拖动东北角（右上角）
        newCropArea.y = Math.max(minY, Math.min(initialCropArea.y + initialCropArea.height - minSize, initialCropArea.y + deltaY));
        newCropArea.width = Math.max(minSize, Math.min(maxX - initialCropArea.x, initialCropArea.width + deltaX));
        newCropArea.height = (initialCropArea.y + initialCropArea.height) - newCropArea.y;
        // 确保最小尺寸
        if (newCropArea.width < minSize) {
          newCropArea.width = minSize;
        }
        if (newCropArea.height < minSize) {
          newCropArea.height = minSize;
          newCropArea.y = (initialCropArea.y + initialCropArea.height) - minSize;
        }
        break;
      case 'sw':
        // 拖动西南角（左下角）
        newCropArea.x = Math.max(minX, Math.min(initialCropArea.x + initialCropArea.width - minSize, initialCropArea.x + deltaX));
        newCropArea.width = (initialCropArea.x + initialCropArea.width) - newCropArea.x;
        newCropArea.height = Math.max(minSize, Math.min(maxY - initialCropArea.y, initialCropArea.height + deltaY));
        // 确保最小尺寸
        if (newCropArea.width < minSize) {
          newCropArea.width = minSize;
          newCropArea.x = (initialCropArea.x + initialCropArea.width) - minSize;
        }
        if (newCropArea.height < minSize) {
          newCropArea.height = minSize;
        }
        break;
      case 'se':
        // 拖动东南角（右下角）
        newCropArea.width = Math.max(minSize, Math.min(maxX - initialCropArea.x, initialCropArea.width + deltaX));
        newCropArea.height = Math.max(minSize, Math.min(maxY - initialCropArea.y, initialCropArea.height + deltaY));
        break;
    }
    
    // 确保裁剪区域在图片范围内
    if (newCropArea.x < minX) {
      newCropArea.width -= (minX - newCropArea.x);
      newCropArea.x = minX;
    }
    if (newCropArea.y < minY) {
      newCropArea.height -= (minY - newCropArea.y);
      newCropArea.y = minY;
    }
    if (newCropArea.x + newCropArea.width > maxX) {
      newCropArea.width = maxX - newCropArea.x;
    }
    if (newCropArea.y + newCropArea.height > maxY) {
      newCropArea.height = maxY - newCropArea.y;
    }
    
    setCropArea(newCropArea);
  };

  // 保存初始裁剪区域（用于拖动计算）
  const initialCropAreaRef = React.useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // 开始拖动（用于裁剪）- 鼠标事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cropMode || !imageContainerRef.current || !cropArea) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    
    const detectedType = detectDragType(coords.x, coords.y, cropArea);
    if (!detectedType) return;
    
    // 保存初始裁剪区域
    initialCropAreaRef.current = { ...cropArea };
    setDragType(detectedType);
    setDragStart(coords);
    setIsDragging(true);
  };

  // 拖动中（更新裁剪区域）- 鼠标事件
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cropMode || !isDragging || !dragStart || !dragType || !initialCropAreaRef.current || !imageContainerRef.current) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    
    updateCropArea(coords.x, coords.y, dragStart, dragType, initialCropAreaRef.current);
  };

  // 结束拖动 - 鼠标事件
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    initialCropAreaRef.current = null;
  };

  // 开始触摸（用于裁剪）- 触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!cropMode || !imageContainerRef.current || !cropArea) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const coords = getRelativeCoordinates(touch.clientX, touch.clientY);
    if (!coords) return;
    
    const detectedType = detectDragType(coords.x, coords.y, cropArea);
    if (!detectedType) return;
    
    // 保存初始裁剪区域
    initialCropAreaRef.current = { ...cropArea };
    setDragType(detectedType);
    setDragStart(coords);
    setIsDragging(true);
  };

  // 触摸移动（更新裁剪区域）- 触摸事件
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!cropMode || !isDragging || !dragStart || !dragType || !initialCropAreaRef.current || !imageContainerRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const coords = getRelativeCoordinates(touch.clientX, touch.clientY);
    if (!coords) return;
    
    updateCropArea(coords.x, coords.y, dragStart, dragType, initialCropAreaRef.current);
  };

  // 结束触摸 - 触摸事件
  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragType(null);
    initialCropAreaRef.current = null;
  };

  // 应用旋转和裁剪
  const handleApplyEdit = () => {
    if (!uploadedImage || !imageRef.current || !imageContainerRef.current) return;

    const img = imageRef.current;
    const container = imageContainerRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 获取图片的实际显示尺寸（不受旋转影响）
    // 注意：即使图片有 CSS 旋转，naturalWidth 和 naturalHeight 仍然是原始尺寸
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    // 获取图片在容器中的显示位置和尺寸
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // 计算图片的实际显示尺寸（考虑 object-contain 的缩放）
    // 当图片使用 object-contain 时，图片会保持宽高比，实际显示尺寸可能小于元素尺寸
    let displayWidth: number;
    let displayHeight: number;
    
    // 获取元素的尺寸
    const elementWidth = imgRect.width;
    const elementHeight = imgRect.height;
    
    // 计算图片的原始宽高比
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = elementWidth / elementHeight;
    
    // 根据 object-contain 的逻辑计算实际显示尺寸
    if (imageAspectRatio > containerAspectRatio) {
      // 图片更宽，按宽度适配
      displayWidth = elementWidth;
      displayHeight = elementWidth / imageAspectRatio;
    } else {
      // 图片更高，按高度适配
      displayWidth = elementHeight * imageAspectRatio;
      displayHeight = elementHeight;
    }
    
    // 计算缩放比例
    const scaleX = naturalWidth / displayWidth;
    const scaleY = naturalHeight / displayHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = naturalWidth;
    let sourceHeight = naturalHeight;

    // 如果有裁剪区域，计算裁剪坐标
    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      // 计算图片在容器中的实际显示位置
      // 当图片使用 object-contain 时，图片内容在元素中是居中的
      let imgDisplayX: number;
      let imgDisplayY: number;
      
      if (imageRotation === 0) {
        // 没有旋转时，需要考虑 object-contain 的居中效果
        // imgRect 是图片元素的边界框，displayWidth/Height 是图片内容的实际尺寸
        const elementWidth = imgRect.width;
        const elementHeight = imgRect.height;
        const contentOffsetX = (elementWidth - displayWidth) / 2;
        const contentOffsetY = (elementHeight - displayHeight) / 2;
        
        imgDisplayX = (imgRect.left - containerRect.left) + contentOffsetX;
        imgDisplayY = (imgRect.top - containerRect.top) + contentOffsetY;
      } else {
        // 有旋转时，通过中心点计算
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;
        imgDisplayX = imgCenterX - containerRect.left - displayWidth / 2;
        imgDisplayY = imgCenterY - containerRect.top - displayHeight / 2;
      }
      
      // 将裁剪区域坐标从容器坐标转换为图片显示坐标
      const cropXRelativeToImage = cropArea.x - imgDisplayX;
      const cropYRelativeToImage = cropArea.y - imgDisplayY;
      
      // 确保裁剪区域在图片范围内
      const clampedCropX = Math.max(0, Math.min(cropXRelativeToImage, displayWidth));
      const clampedCropY = Math.max(0, Math.min(cropYRelativeToImage, displayHeight));
      const clampedCropWidth = Math.max(0, Math.min(cropArea.width, displayWidth - clampedCropX));
      const clampedCropHeight = Math.max(0, Math.min(cropArea.height, displayHeight - clampedCropY));
      
      // 将显示坐标转换为实际图片坐标（翻转时 X 需取反）
      sourceWidth = clampedCropWidth * scaleX;
      sourceHeight = clampedCropHeight * scaleY;
      if (imageFlipH && imageRotation === 0) {
        sourceX = (displayWidth - clampedCropX - clampedCropWidth) * scaleX;
        sourceY = clampedCropY * scaleY;
      } else {
        sourceX = clampedCropX * scaleX;
        sourceY = clampedCropY * scaleY;
      }
      
      // 确保不超出图片边界
      sourceX = Math.max(0, Math.min(sourceX, naturalWidth));
      sourceY = Math.max(0, Math.min(sourceY, naturalHeight));
      sourceWidth = Math.max(0, Math.min(sourceWidth, naturalWidth - sourceX));
      sourceHeight = Math.max(0, Math.min(sourceHeight, naturalHeight - sourceY));
    }

    // 第一步：先应用裁剪（如果有）
    let workingCanvas = canvas;
    let workingCtx = ctx;
    
    if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
      workingCanvas.width = sourceWidth;
      workingCanvas.height = sourceHeight;
      workingCtx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, sourceWidth, sourceHeight
      );
    } else {
      // 没有裁剪，直接使用原图
      workingCanvas.width = img.naturalWidth;
      workingCanvas.height = img.naturalHeight;
      workingCtx.drawImage(img, 0, 0);
    }

    // 第二步：应用水平翻转（如果有）
    if (imageFlipH) {
      const flipCanvas = document.createElement('canvas');
      flipCanvas.width = workingCanvas.width;
      flipCanvas.height = workingCanvas.height;
      const flipCtx = flipCanvas.getContext('2d');
      if (!flipCtx) {
        handleCloseImageEditor();
        return;
      }
      flipCtx.translate(flipCanvas.width, 0);
      flipCtx.scale(-1, 1);
      flipCtx.drawImage(workingCanvas, 0, 0);
      workingCanvas = flipCanvas;
    }

    // 第三步：应用旋转（如果有）
    if (imageRotation !== 0) {
      const rad = (imageRotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const newWidth = workingCanvas.width * cos + workingCanvas.height * sin;
      const newHeight = workingCanvas.width * sin + workingCanvas.height * cos;

      const rotatedCanvas = document.createElement('canvas');
      const rotatedCtx = rotatedCanvas.getContext('2d');
      if (!rotatedCtx) {
        handleCloseImageEditor();
        return;
      }

      rotatedCanvas.width = newWidth;
      rotatedCanvas.height = newHeight;

      // 设置背景为白色（透明区域）
      rotatedCtx.fillStyle = '#FFFFFF';
      rotatedCtx.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);

      // 移动到中心点
      rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rotatedCtx.rotate(rad);
      rotatedCtx.translate(-workingCanvas.width / 2, -workingCanvas.height / 2);

      // 绘制图片
      rotatedCtx.drawImage(workingCanvas, 0, 0);
      workingCanvas = rotatedCanvas;
    }

    // 转换为 base64（使用压缩质量 0.8 以减小体积）
    // 对于 PNG/GIF，如果不需要透明度，转换为 JPEG 以减小体积
    let outputMimeType = uploadedImage.mimeType;
    if (uploadedImage.mimeType === 'image/png' || uploadedImage.mimeType === 'image/gif') {
      // 转换为 JPEG 以减小体积（教育内容通常不需要透明度）
      outputMimeType = 'image/jpeg';
    }
    const dataUrl = workingCanvas.toDataURL(outputMimeType, 0.8);
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      const mimeType = base64Match[1];
      const base64 = base64Match[2];
      setUploadedImage({
        file: uploadedImage.file,
        dataUrl,
        base64,
        mimeType
      });
    }

    handleCloseImageEditor();
  };

  // 移除图片
  const handleRemoveImage = () => {
    setUploadedImage(null);
    // 重置文件输入框，以便可以再次选择同一个文件
    const fileInput = document.getElementById('image-upload-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // 提交异步生成
  const handleAsyncAiGenerate = async () => {
    // 防止重复提交
    if (aiGenerating) {
      return;
    }
    
    if (!knowledgePoint.trim()) {
      setError(t('pleaseEnterKnowledgePoint', { ns: 'content', defaultValue: 'Please enter a knowledge point' }));
      return;
    }

    // 未登录用户：检查免费试用状态
    if (!user) {
      try {
        await fetchTrialStatus();
        if (trialStatus?.content_generated) {
          setShowRegistrationPrompt(true);
          setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
          return;
        }
      } catch (e) {
        // 静默失败，继续尝试生成
      }
    }

    // 已登录用户：前置校验：credits 与 pending 队列
    if (user) {
      try {
        await fetchPrecheckInfo();
      } catch {}
      if (creditsBalance !== null && creditsBalance <= 0) {
        setError(t('errors.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' }));
        return;
      }
      if (pendingCount >= 3) {
        setError(t('errors.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务' }));
        return;
      }
    }

    // 在设置状态之前再次检查，防止竞态条件
    if (aiGenerating) {
      return;
    }
    
    // 保存当前值用于生成
    const currentKnowledgePoint = knowledgePoint.trim();
    const currentDescription = description;
    const currentUploadedImage = uploadedImage;
    
    // 立即清空AI生成表单，防止重复点击
    setKnowledgePoint('');
    setUploadedImage(null);
    setAiGenerating(true);
    setError('');
    
    try {
      const rawTitle = currentKnowledgePoint;
      const safeTitle = rawTitle.length > 200 ? (rawTitle.slice(0, 200)) : rawTitle;
      
      let contentResponse;
      let generateResponse;

      if (!user) {
        // 未登录用户：使用免费生成接口
        // 注意：这个接口会创建 content 并添加任务，所以只需要调用一次
        let idempotencyKey = [
          'free',
          currentKnowledgePoint,
          outputType,
          language,
          currentDescription || '',
          currentUploadedImage ? currentUploadedImage.mimeType : 'noimg'
        ].join('|');

        // 防止 idempotency_key 超过后端 4096 字符限制
        if (idempotencyKey.length > 4000) {
          idempotencyKey = idempotencyKey.slice(0, 4000);
        }

        generateResponse = await api.generateContentFree({
          knowledgePoint: currentKnowledgePoint,
          output_type: outputType,
          description: currentDescription,
          language_code: language,
          image: currentUploadedImage ? {
            mime_type: currentUploadedImage.mimeType,
            data: currentUploadedImage.base64
          } : undefined,
          idempotency_key: idempotencyKey
        });

        if (!(generateResponse && (generateResponse as any).success)) {
          const errorCode = (generateResponse as any)?.error;
          if (errorCode === 'FREE_TRIAL_USED') {
            setShowRegistrationPrompt(true);
            setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
            return;
          }
          throw new Error((generateResponse as any)?.error || (generateResponse as any)?.message || '生成失败');
        }

        // 免费生成接口返回的内容数据
        contentResponse = (generateResponse as any).data;
        if (!contentResponse || !contentResponse.id) {
          throw new Error('生成内容失败');
        }

        // 标记免费试用已使用
        if ((generateResponse as any).freeTrialUsed) {
          setTrialStatus({ content_generated: true, ai_guide_used: trialStatus?.ai_guide_used || false });
          setShowRegistrationPrompt(true);
        }

        // 游客生成后，跳转到结果页面
        // 注意：在跳转前先设置状态，避免后续逻辑执行
        setAiGenerating(false);
        if (contentResponse.short_id) {
          // 先执行跳转，然后立即返回，不执行后续的 sessionStorage 和事件分发逻辑
          // 因为这些逻辑应该在目标页面处理，而不是在当前页面
          router.push(`/c/${contentResponse.short_id}`);
          return; // 跳转后直接返回，不执行后续逻辑
        }
      } else {
        // 已登录用户：使用原有流程
        const contentData = {
          title: safeTitle,
          description: currentDescription || '',
          language_code: language,
          content_type: 'vue',
          full_html: DEFAULT_FULL_HTML || '',
          tags: [],
          created_by: user.id,
        } as any;

        contentResponse = await api.content.create(contentData);
        if (!contentResponse || !contentResponse.id) {
          throw new Error('创建内容记录失败');
        }

        let idempotencyKey = [
          'gen',
          contentResponse.id,
          currentKnowledgePoint,
          outputType,
          language,
          currentDescription || '',
          currentUploadedImage ? currentUploadedImage.mimeType : 'noimg'
        ].join('|');

        // 防止 idempotency_key 超过后端 4096 字符限制
        if (idempotencyKey.length > 4000) {
          idempotencyKey = idempotencyKey.slice(0, 4000);
        }

        generateResponse = await api.generateContentAsync(contentResponse.id, {
          knowledge_point: currentKnowledgePoint,
          output_type: outputType,
          description: currentDescription,
          language_code: language,
          ...(user.role === 'admin' && aiProvider && ['ark', 'kimi', 'qenda'].includes(aiProvider)
            ? { provider: aiProvider }
            : {}),
          image: currentUploadedImage ? {
            mime_type: currentUploadedImage.mimeType,
            data: currentUploadedImage.base64
          } : undefined,
          idempotency_key: idempotencyKey
        });

        if (!(generateResponse && (generateResponse as any).success)) {
          throw new Error((generateResponse as any)?.error || '启动异步生成失败');
        }
      }

      // 1) 写入 sessionStorage，供跨页面或刷新后拾取
      try {
        const payload = { id: contentResponse.id, q: rawTitle, lang: language };
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('new_content', JSON.stringify(payload));
        }
        // 2) 通过事件通知当前页面即时插入乐观卡片
        window.dispatchEvent(new CustomEvent('NEW_CONTENT_CREATED', { detail: payload }));
        // 本地 pending 计数 +1（仅已登录用户）
        if (user) {
          setPendingCount(prev => prev + 1);
        }
      } catch {}

      // 3) 已登录用户生成后跳转到 /c 页面查看生成状态
      if (user) {
        router.push('/c?refresh=true');
        return; // 跳转后直接返回，不执行后续逻辑
      }

      // 4) 让外部回调进行列表刷新等后续动作（可选，仅未登录用户）
      if (onGenerated) onGenerated();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('401') || msg.includes('无效的访问令牌') || msg.includes('访问令牌缺失')) {
        window.location.href = '/login';
        return;
      }
      // 检查是否是免费试用已用完的错误
      if (msg.includes('FREE_TRIAL_USED') || msg.includes('免费试用已用完')) {
        setShowRegistrationPrompt(true);
        setError(t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' }));
        return;
      }
      
      const errMsg = e?.message || String(e);
      const isNetworkError = errMsg.includes('fetch') || errMsg.includes('Failed to fetch') || errMsg.includes('网络连接') || errMsg.includes('请求超时') || errMsg.includes('timeout');
      const errorMsg = isNetworkError
        ? handleNetworkError(e, t('errors.submitGenerateFailed', { ns: 'content', defaultValue: '提交生成请求失败' }))
        : (await import('@/utils/translateApiError')).translateApiError(e, 'submitGenerateFailed');
      setError(errorMsg);
      if (!isNetworkError) {
        const { toast } = await import('@/utils/toast');
        toast.error(errorMsg, 5000);
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // 按钮禁用时的提示文字（多语言）
  const getBuildKnowledgeDisabledHint = () => {
    if (aiGenerating) return t('buildKnowledgeDisabledHint.generating', { ns: 'content', defaultValue: '正在生成中...' });
    if (checking) return t('buildKnowledgeDisabledHint.checking', { ns: 'content', defaultValue: '正在检查...' });
    if (!knowledgePoint.trim()) return t('buildKnowledgeDisabledHint.enterRequirement', { ns: 'content', defaultValue: '请输入要求' });
    if (user && creditsBalance !== null && creditsBalance <= 0) return t('buildKnowledgeDisabledHint.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' });
    if (user && pendingCount >= 3) return t('buildKnowledgeDisabledHint.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务，请等待当前任务完成' });
    if (!user && trialStatus?.content_generated) return t('buildKnowledgeDisabledHint.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' });
    if (isAiFormDisabled) return t('buildKnowledgeDisabledHint.checking', { ns: 'content', defaultValue: '正在检查...' });
    return '';
  };

  const isBuildKnowledgeDisabled = isAiFormDisabled || aiGenerating || !knowledgePoint.trim() || checking || (user && creditsBalance !== null && creditsBalance <= 0) || (user && pendingCount >= 3) || (!user && trialStatus?.content_generated);

  return (
    <div className={`ai-gen-border ${className || ''}`}>
      <div
        ref={containerRef}
        className="relative flex flex-col gap-3 rounded-2xl lg:rounded-[30px] p-5 shadow-xl shadow-primary/10 border border-white/40 bg-card/30 backdrop-blur-md lg:backdrop-blur-xl overflow-hidden"
      >
      {/* 背景层：桌面端=星空+粒子，移动端=静态渐变（性能降级） */}
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          background: isDesktop
            ? 'radial-gradient(circle at 30% 20%, #120023 0%, #04000a 60%, #000 100%)'
            : 'radial-gradient(circle at 30% 20%, #1a0a2e 0%, #0d0218 50%, #050208 100%)',
        }}
      />
      {isDesktop && <StarfieldBackground containerRef={containerRef} />}
      {/* 背景柔和高光 */}
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-60">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[#a78bfa]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-[#ec4899]/15 blur-3xl" />
      </div>

      <h3 className="text-lg font-semibold text-white/90 mb-1 relative z-10">
        {mounted ? t('aiGenerate', { ns: 'content', defaultValue: '动画解题 · 自动生成课件' }) : '动画解题 · 自动生成课件'}
      </h3>

      {error && (
        <div className="relative z-10 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 relative z-10">
        <div>
          {/* 图片预览区域（显示在对话框上部） */}
          {uploadedImage && (
            <div className="mb-3 border border-border rounded-lg overflow-hidden bg-card shadow-sm">
              <div className="relative bg-muted/30">
                <img
                  src={uploadedImage.dataUrl}
                  alt="Uploaded"
                  className="w-full h-auto max-h-32 object-contain block"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={handleEditImage}
                    disabled={isAiFormDisabled}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition disabled:opacity-50 backdrop-blur-sm shadow-md"
                    title={mounted ? t('editImage', { ns: 'content', defaultValue: '编辑图片' }) : 'Edit Image'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isAiFormDisabled}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition disabled:opacity-50 backdrop-blur-sm shadow-md"
                    title={mounted ? t('removeImage', { ns: 'content', defaultValue: '移除图片' }) : 'Remove image'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* 文字输入区域 */}
          <div className="relative">
            <div className="ai-gen-focus-wrap ai-gen-focus-wrap-transparent rounded-lg">
            <textarea
              className="w-full border-0 p-2 pr-2 pb-10 rounded-[6px] focus:outline-none focus:ring-0 bg-black/25 focus:bg-transparent backdrop-blur-sm focus:backdrop-blur-none resize-none h-40 text-white placeholder:text-white/60"
              value={knowledgePoint}
              onChange={e => setKnowledgePoint(e.target.value)}
              onPaste={async (e) => {
                // 检测粘贴的内容是否是图片
                const items = e.clipboardData?.items;
                if (!items) return;

                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  // 检查是否是图片类型
                  if (item.type.indexOf('image') !== -1) {
                    e.preventDefault(); // 阻止默认粘贴行为
                    
                    const file = item.getAsFile();
                    if (file) {
                      // 使用现有的图片处理逻辑
                      await processImageFile(file);
                    }
                    return; // 只处理第一个图片
                  }
                }
              }}
              placeholder={(() => {
                if (!mounted) return 'For example: Fraction operations, cell structure, Newton\'s laws...';
                if (!knowledgePoint.trim()) {
                  const examples = t('knowledgePointExamples', { ns: 'content', returnObjects: true }) as string[];
                  if (Array.isArray(examples) && examples.length > 0) {
                    return examples[examplePromptIndex] || t('knowledgePointPlaceholder', { ns: 'content', defaultValue: 'For example: Fraction operations, cell structure, Newton\'s laws...' });
                  }
                }
                return t('knowledgePointPlaceholder', { ns: 'content', defaultValue: 'For example: Fraction operations, cell structure, Newton\'s laws...' });
              })()}
              required
              disabled={isAiFormDisabled}
              maxLength={maxKnowledgeLength}
            />
            </div>
            {/* 底部左侧按钮区域（语言选择、输出类型和图片上传，并排显示） */}
            <div className="absolute bottom-2 left-2 flex gap-2 items-center z-10">
              {/* 语言选择按钮 */}
              <button
                type="button"
                onClick={() => !isAiFormDisabled && setShowLanguagePicker(true)}
                disabled={isAiFormDisabled}
                className="h-8 px-2 flex items-center text-sm border-2 border-white/30 rounded bg-transparent text-white/90 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: '选择输出语言' }) : 'Select Output Language'}
              >
                {language ? getLanguageLabel(language) : (mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: '选择语言' }) : 'Select Language')}
              </button>
              {/* 输出类型选择器 */}
              <div className="ai-gen-focus-wrap ai-gen-focus-wrap-transparent h-8 inline-flex items-stretch !border-2 !border-white/30 !rounded">
                <select
                  value={outputType}
                  onChange={(e) => setOutputType(e.target.value as 'interactive' | 'animated')}
                  disabled={isAiFormDisabled}
                  className="h-full px-2 text-sm border-0 rounded-[2px] focus:outline-none focus:ring-0 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed bg-transparent text-white/90 min-w-0 cursor-pointer"
                  title={mounted ? t('outputType.select', { ns: 'content', defaultValue: '选择输出类型' }) : 'Select Output Type'}
                >
                  <option value="interactive">
                    {mounted ? t('outputType.interactive', { ns: 'content', defaultValue: '交互式' }) : 'Interactive'}
                  </option>
                  <option value="animated">
                    {mounted ? t('outputType.animated', { ns: 'content', defaultValue: '动画' }) : 'Animated'}
                  </option>
                </select>
              </div>
              {/* 图片上传按钮 */}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageSelect}
                disabled={isAiFormDisabled || imageUploading}
                className="hidden"
                id="image-upload-input"
              />
              <div className="relative inline-flex items-center justify-center p-1.5">
                {/* 外圈呼吸动画：环在 padding 区域，不超出容器避免被 overflow-hidden 裁剪 */}
                <div className="absolute inset-0 rounded-full breathing-ring pointer-events-none"></div>
                <label
                  htmlFor="image-upload-input"
                  className={`relative z-10 cursor-pointer p-1.5 rounded hover:bg-muted/50 transition ${isAiFormDisabled || imageUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={mounted ? t('uploadImage', { ns: 'content', defaultValue: '上传图片' }) : 'Upload Image'}
                >
                  {imageUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  ) : (
                    <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </label>
              </div>
              {/* 提示文字 */}
              <span 
                className={`text-xs text-muted-foreground transition-opacity duration-2500 whitespace-nowrap ${
                  showUploadHint ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {mounted ? t('uploadImageHint', { ns: 'content', defaultValue: '拍题生成动画讲解' }) : '拍题生成动画讲解'}
              </span>
            </div>
          </div>
          <div className="flex justify-end items-center mt-1">
            <span className={`text-xs ${
              knowledgePoint.length > maxKnowledgeLength * 0.9
                ? 'text-destructive'
                : knowledgePoint.length > maxKnowledgeLength * 0.8
                  ? 'text-warning'
                  : 'text-muted-foreground'
            }`}>
              {knowledgePoint.length}/{maxKnowledgeLength}
            </span>
          </div>
        </div>

        {user && user.role === 'admin' && (
          <div>
            <AIProviderSelector
              selectedProvider={aiProvider}
              onProviderChange={setAiProvider}
              disabled={isAiFormDisabled}
              className="mb-2"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        data-state={aiGenerating ? 'down' : undefined}
        className="ai-gen-submit-btn w-full relative z-10 group"
        onClick={(e) => {
          // 移动端：如果已经处理了 touchstart，忽略 click 事件
          if ((e.target as HTMLElement).hasAttribute('data-touch-handled')) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          handleAsyncAiGenerate();
        }}
        onTouchStart={(e) => {
          // 移动端防止双击触发：使用 touchstart 而不是 click，避免 click 事件延迟导致的重复触发
          if (aiGenerating || isAiFormDisabled || !knowledgePoint.trim()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // 标记已处理触摸事件，防止后续 click 事件触发
          (e.target as HTMLElement).setAttribute('data-touch-handled', 'true');
          // 阻止后续的 click 事件
          e.preventDefault();
          handleAsyncAiGenerate();
          // 延迟清除标记，确保 click 事件不会触发
          setTimeout(() => {
            (e.target as HTMLElement).removeAttribute('data-touch-handled');
          }, 300);
        }}
        disabled={isBuildKnowledgeDisabled}
        title={isBuildKnowledgeDisabled ? getBuildKnowledgeDisabledHint() : undefined}
      >
        <div className="w-full flex items-center justify-center gap-2 px-6 py-3.5 font-semibold rounded-2xl ai-gradient-btn shadow-lg shadow-primary/30 group-disabled:opacity-60 group-disabled:cursor-not-allowed">
          {aiGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/40 border-t-white"></div>
              <span>🤖 {t('startingGeneration', { ns: 'content', defaultValue: '正在启动生成...' })}</span>
            </>
          ) : (
            <span>
              {isBuildKnowledgeDisabled && !knowledgePoint.trim()
                ? (mounted ? t('buildKnowledgeDisabledHint.enterRequirement', { ns: 'content', defaultValue: '请输入要求' }) : '请输入要求')
                : ('🚀 ' + (mounted ? t('buildKnowledge', { ns: 'content', defaultValue: '构建知识' }) : '构建知识'))}
            </span>
          )}
        </div>
      </button>

      {user && (creditsBalance !== null && creditsBalance <= 0) && (
        <div className="text-sm text-destructive">{t('errors.insufficientCredits', { ns: 'content', defaultValue: '积分不足，无法生成' })}</div>
      )}
      {user && (pendingCount >= 3) && (
        <div className="text-sm text-muted-foreground">{t('errors.queueLimitReached', { ns: 'content', defaultValue: '队列不能超过3个任务' })}</div>
      )}
      {!user && trialStatus?.content_generated && (
        <div className="text-sm text-destructive mb-2">
          {t('errors.freeTrialUsed', { ns: 'content', defaultValue: '请登录后继续使用' })}
        </div>
      )}

      {showLanguagePicker && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" aria-modal="true" role="dialog" onClick={() => setShowLanguagePicker(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-4 mx-4 border border-slate-200 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{mounted ? t('selectOutputLanguage', { ns: 'content', defaultValue: 'Select Output Language' }) : 'Select Output Language'}</h3>
              <button className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" onClick={() => setShowLanguagePicker(false)}>✕</button>
            </div>
            <input
              className="w-full border border-slate-300 dark:border-slate-600 p-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#a78bfa] bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              value={languageSearch}
              onChange={e => setLanguageSearch(e.target.value)}
              placeholder={mounted ? t('searchLanguage', { ns: 'content', defaultValue: 'Search language...' }) : 'Search language...'}
            />
            <div className="max-h-80 overflow-auto border border-slate-200 dark:border-slate-600 rounded-lg bg-gray-50/50 dark:bg-slate-700/50">
              {filteredLanguages.map(l => (
                <div
                  key={l.code}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between ${language === l.code ? 'bg-[#a78bfa]/15 dark:bg-[#a78bfa]/20 text-[#a78bfa]' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600'}`}
                  onClick={() => handleSelectLanguage(l.code)}
                >
                  <div className="font-medium">{l.label}</div>
                  {language === l.code && <span>✓</span>}
                </div>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">{mounted ? t('noResults', { ns: 'common', defaultValue: '暂无结果' }) : 'No results'}</div>
              )}
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-white" onClick={() => setShowLanguagePicker(false)}>
                {mounted ? t('cancel', { ns: 'common', defaultValue: '取消' }) : 'Cancel'}
              </button>
              <button className="tile button" onClick={() => setShowLanguagePicker(false)}>
                <div className="tile px-4 py-2 font-medium">{mounted ? t('confirm', { ns: 'common', defaultValue: '确定' }) : 'Confirm'}</div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 图片编辑器模态框 */}
      {showImageEditor && uploadedImage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" aria-modal="true" role="dialog" onClick={handleCloseImageEditor}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl p-4 m-4 border border-slate-200 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mounted ? t('editImage', { ns: 'content', defaultValue: '编辑图片' }) : 'Edit Image'}
              </h3>
              <button
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                onClick={handleCloseImageEditor}
              >
                ✕
              </button>
            </div>
            
            {/* 图片预览区域 */}
            <div
              ref={imageContainerRef}
              className="relative bg-muted/30 rounded-lg overflow-hidden mb-4 cursor-crosshair touch-none"
              style={{ minHeight: '300px', userSelect: 'none', WebkitUserSelect: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <img
                ref={imageRef}
                src={uploadedImage.dataUrl}
                alt="Edit"
                className="w-full h-auto max-h-96 object-contain block select-none"
                style={{
                  transform: `scaleX(${imageFlipH ? -1 : 1}) rotate(${imageRotation}deg)`,
                  transition: 'transform 0.3s ease',
                  pointerEvents: 'none'
                }}
                draggable={false}
              />
              {/* 裁剪框 */}
              {cropMode && cropArea && cropArea.width > 0 && cropArea.height > 0 && (
                <>
                  {/* 顶部遮罩 */}
                  <div
                    className="absolute bg-black/50"
                    style={{
                      top: 0,
                      left: 0,
                      right: 0,
                      height: `${cropArea.y}px`
                    }}
                  />
                  {/* 底部遮罩 */}
                  <div
                    className="absolute bg-black/50"
                    style={{
                      bottom: 0,
                      left: 0,
                      right: 0,
                      top: `${cropArea.y + cropArea.height}px`
                    }}
                  />
                  {/* 左侧遮罩 */}
                  <div
                    className="absolute bg-black/50"
                    style={{
                      top: `${cropArea.y}px`,
                      left: 0,
                      width: `${cropArea.x}px`,
                      height: `${cropArea.height}px`
                    }}
                  />
                  {/* 右侧遮罩 */}
                  <div
                    className="absolute bg-black/50"
                    style={{
                      top: `${cropArea.y}px`,
                      right: 0,
                      left: `${cropArea.x + cropArea.width}px`,
                      height: `${cropArea.height}px`
                    }}
                  />
                  {/* 裁剪框边框 */}
                  <div
                    className="absolute border-2 border-primary"
                    style={{
                      left: `${cropArea.x}px`,
                      top: `${cropArea.y}px`,
                      width: `${cropArea.width}px`,
                      height: `${cropArea.height}px`,
                      cursor: isDragging && dragType === 'move' ? 'grabbing' : 'grab'
                    }}
                  />
                  {/* 四个角的拖动手柄 */}
                  {/* 西北角 */}
                  <div
                    className="absolute bg-primary border-2 border-white rounded-full cursor-nwse-resize"
                    style={{
                      left: `${cropArea.x - 10}px`,
                      top: `${cropArea.y - 10}px`,
                      width: '20px',
                      height: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                  {/* 东北角 */}
                  <div
                    className="absolute bg-primary border-2 border-white rounded-full cursor-nesw-resize"
                    style={{
                      left: `${cropArea.x + cropArea.width - 10}px`,
                      top: `${cropArea.y - 10}px`,
                      width: '20px',
                      height: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                  {/* 西南角 */}
                  <div
                    className="absolute bg-primary border-2 border-white rounded-full cursor-nesw-resize"
                    style={{
                      left: `${cropArea.x - 10}px`,
                      top: `${cropArea.y + cropArea.height - 10}px`,
                      width: '20px',
                      height: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                  {/* 东南角 */}
                  <div
                    className="absolute bg-primary border-2 border-white rounded-full cursor-nwse-resize"
                    style={{
                      left: `${cropArea.x + cropArea.width - 10}px`,
                      top: `${cropArea.y + cropArea.height - 10}px`,
                      width: '20px',
                      height: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  />
                </>
              )}
            </div>

            {/* 控制按钮 */}
            <div className="flex gap-2 justify-center mb-4 flex-wrap">
              <button
                type="button"
                onClick={handleFlipImage}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
                title={mounted ? t('flip', { ns: 'content', defaultValue: '翻转' }) : 'Flip'}
                disabled={cropMode}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22V2M2 12h20M4 6l4 6-4 6M20 6l-4 6 4 6" />
                </svg>
                {mounted ? t('flip', { ns: 'content', defaultValue: '翻转' }) : 'Flip'}
              </button>
              <button
                type="button"
                onClick={() => handleRotateImage(90)}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
                title={mounted ? t('rotateRight', { ns: 'content', defaultValue: '向右旋转' }) : 'Rotate Right'}
                disabled={cropMode}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {mounted ? t('rotateRight', { ns: 'content', defaultValue: '向右旋转 90°' }) : 'Rotate Right 90°'}
              </button>
              {!cropMode ? (
                <button
                  type="button"
                  onClick={handleStartCrop}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
                  title={mounted ? t('startCrop', { ns: 'content', defaultValue: '开始裁剪' }) : 'Start Crop'}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {mounted ? t('startCrop', { ns: 'content', defaultValue: '开始裁剪' }) : 'Start Crop'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelCrop}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition flex items-center"
                  title={mounted ? t('cancelCrop', { ns: 'content', defaultValue: '取消裁剪' }) : 'Cancel Crop'}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {mounted ? t('cancelCrop', { ns: 'content', defaultValue: '取消裁剪' }) : 'Cancel Crop'}
                </button>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCloseImageEditor}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition"
              >
                {mounted ? t('cancel', { ns: 'common', defaultValue: '取消' }) : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleApplyEdit}
                className="tile button"
              >
                <div className="tile px-4 py-2 font-medium">{mounted ? t('apply', { ns: 'content', defaultValue: '应用' }) : 'Apply'}</div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <RegistrationPrompt
        type={trialStatus?.content_generated ? 'trialUsed' : 'generation'}
        onRegister={() => setShowRegistrationPrompt(false)}
        onDismiss={() => setShowRegistrationPrompt(false)}
        visible={showRegistrationPrompt && !user}
      />
      </div>
    </div>
  );
}
