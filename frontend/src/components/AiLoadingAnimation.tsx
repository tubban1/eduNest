import React, { useState, useEffect, useRef } from 'react';

// 动画阶段配置
const LOADING_STAGES = [
  {
    name: "Knowledge Parsing",
    messages: [
      "Initializing conceptual graph for {{knowledge_point}}…",
      "Extracting semantic hierarchy and latent structures…",
      "Decoding taxonomies and domain relevance vectors…"
    ]
  },
  {
    name: "Pedagogical Modeling",
    messages: [
      "Generating learning scaffolds and progression schema…",
      "Simulating cognitive load maps for effective sequencing…",
      "Aligning outcomes with adaptive instructional design…"
    ]
  },
  {
    name: "Interface Schema Synthesis",
    messages: [
      "Building interface layout trees and responsive containers…",
      "Injecting accessibility vectors and tactile UX models…",
      "Establishing visual narrative flow and structural rhythm…"
    ]
  },
  {
    name: "Logic and Computation Layer",
    messages: [
      "Composing reactive logic with declarative bindings…",
      "Instantiating interaction events and stateflows…",
      "Defining dynamic data graphs for UI orchestration…"
    ]
  },
  {
    name: "Motion and Feedback Systems",
    messages: [
      "Embedding transition curves and gesture mappings…",
      "Sequencing keyframe events for pedagogical emphasis…",
      "Constructing micro-feedback mechanisms in real-time…"
    ]
  },
  {
    name: "Auditory Architecture",
    messages: [
      "Mapping cognitive events to tonal feedback cues…",
      "Integrating procedural audio with concept triggers…",
      "Optimizing feedback latency with Tone.js core…"
    ]
  },
  {
    name: "Dependency and Runtime Linking",
    messages: [
      "Injecting runtime modules and loading external graphs…",
      "Verifying CDN resolutions and interface exposure maps…",
      "Configuring sandbox security and runtime bridges…"
    ]
  },
  {
    name: "Systemic Testing",
    messages: [
      "Running interaction stress tests with simulated agents…",
      "Measuring feedback loop integrity and accessibility thresholds…",
      "Analyzing logical cohesion across user paths…"
    ]
  },
  {
    name: "Deployment Pipeline",
    messages: [
      "Bundling resources and launching runtime sandbox…",
      "Streaming deployment payload to sandbox environment…",
      "Stabilizing environment… Preparing first render…"
    ]
  }
];

interface AiLoadingAnimationProps {
  isActive: boolean;
  knowledgePoint: string;
  onComplete?: () => void;
}

export default function AiLoadingAnimation({ 
  isActive, 
  knowledgePoint, 
  onComplete 
}: AiLoadingAnimationProps) {
  //console.log('AiLoadingAnimation render:', { isActive, knowledgePoint });
  const [currentStage, setCurrentStage] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  
  const stageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 渐隐渐显效果
  const fadeMessage = (message: string) => {
    //console.log('开始渐隐渐显效果，消息:', message);
    
    // 清理之前的定时器
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }
    
    // 先渐隐
    setIsVisible(false);
    
    setTimeout(() => {
      // 更新消息内容
      setDisplayedMessage(message);
      // 再渐显
      setIsVisible(true);
    }, 300); // 渐隐时间
  };

  // 开始动画
  useEffect(() => {
    if (!isActive) {
      // 清理所有定时器
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      
      // 重置状态
      setCurrentStage(0);
      setCurrentMessage(0);
      setDisplayedMessage('');
      setProgress(0);
      return;
    }

    //console.log('Loading动画启动，当前阶段:', currentStage, '当前消息:', currentMessage);

    // 开始第一个消息的渐隐渐显效果
    const currentStageData = LOADING_STAGES[currentStage];
    const message = currentStageData.messages[currentMessage]
      .replace('{{knowledge_point}}', knowledgePoint);
    //console.log('开始渐隐渐显效果，消息:', message);
    fadeMessage(message);

    // 设置阶段切换定时器（每10秒切换一个阶段）
    stageIntervalRef.current = setInterval(() => {
      //console.log('阶段切换定时器触发');
      setCurrentStage(prev => {
        const nextStage = prev + 1;
        //console.log('阶段切换:', prev, '->', nextStage, '总阶段数:', LOADING_STAGES.length);
        if (nextStage >= LOADING_STAGES.length) {
          // 如果到达最后一个阶段，循环播放
          return LOADING_STAGES.length - 1;
        }
        return nextStage;
      });
    }, 10000);

    // 设置消息切换定时器（每3秒切换一个消息）
    messageIntervalRef.current = setInterval(() => {
      //console.log('消息切换定时器触发');
      setCurrentMessage(prev => {
        const currentStageData = LOADING_STAGES[currentStage];
        const nextMessage = prev + 1;
        //console.log('消息切换:', prev, '->', nextMessage, '总消息数:', currentStageData.messages.length);
        if (nextMessage >= currentStageData.messages.length) {
          return 0; // 重新开始当前阶段的消息
        }
        return nextMessage;
      });
    }, 3000);

    return () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
      if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, [isActive, knowledgePoint]);

  // 监听消息变化，开始打字效果
  useEffect(() => {
    if (isActive && currentStage < LOADING_STAGES.length) {
      const currentStageData = LOADING_STAGES[currentStage];
      if (currentStageData && currentMessage < currentStageData.messages.length) {
        const message = currentStageData.messages[currentMessage]
          .replace('{{knowledge_point}}', knowledgePoint);
        //console.log('Loading动画 - 当前阶段:', currentStageData.name);
        //console.log('Loading动画 - 当前消息:', message);
        fadeMessage(message);
      }
    }
  }, [currentStage, currentMessage, knowledgePoint, isActive]);

  // 更新进度
  useEffect(() => {
    if (isActive) {
      const stageProgress = (currentStage / (LOADING_STAGES.length - 1)) * 100;
      const messageProgress = (currentMessage / (LOADING_STAGES[currentStage]?.messages.length || 1)) * (100 / (LOADING_STAGES.length - 1));
      setProgress(Math.min(stageProgress + messageProgress, 99)); // 最多99%，留1%给完成
    }
  }, [currentStage, currentMessage, isActive]);

  if (!isActive) return null;

  const currentStageData = LOADING_STAGES[currentStage];

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-50"></div>
        
        {/* 进度条 */}
        <div className="relative mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">
            {Math.round(progress)}% Complete
          </div>
        </div>

        {/* 当前阶段标题 */}
        <div className="text-center mb-6">
          <div className="text-sm text-secondary font-medium mb-1">
            Stage {currentStage + 1} of {LOADING_STAGES.length}
          </div>
          <div className="text-xl font-bold text-gray-800">
            {currentStageData.name}
          </div>
        </div>

        {/* 消息显示区域 */}
        <div className="bg-gray-50 rounded-lg p-6 min-h-[120px] flex items-center justify-center">
          <div className="text-center">
            <div className={`text-lg text-gray-700 font-mono whitespace-pre-wrap transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              {displayedMessage ? displayedMessage.replace(
                knowledgePoint, 
                knowledgePoint.length > 1000 ? knowledgePoint.substring(0, 1000) + '...' : knowledgePoint
              ) : '正在加载...'}
            </div>
            {/* 字符计数显示 */}
            {knowledgePoint && (
              <div className="text-xs text-gray-500 mt-2">
                知识点长度: {knowledgePoint.length}/1000 字符
                {knowledgePoint.length > 900 && (
                  <span className="text-red-500 ml-2">⚠️ 接近限制</span>
                )}
              </div>
            )}
            {/* 调试信息 */}
            <div className="text-xs text-gray-500 mt-2">
              调试: 阶段={currentStage}, 消息={currentMessage}, 显示长度={displayedMessage.length}
            </div>
          </div>
        </div>

        {/* 动画指示器 */}
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            {LOADING_STAGES.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStage 
                    ? 'bg-secondary scale-125' 
                    : index < currentStage 
                    ? 'bg-green-500' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="text-center mt-6">
          <div className="text-sm text-gray-500">
            🤖 AI正在构建交互式教学项目...
          </div>
          <div className="text-xs text-gray-400 mt-1">
            请耐心等待，这可能需要2-3分钟
          </div>
        </div>

        {/* 旋转光圈装饰 */}
        <div className="absolute -top-4 -right-4 w-24 h-24 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin opacity-30"></div>
        <div className="absolute -bottom-4 -left-4 w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin opacity-30" style={{ animationDirection: 'reverse' }}></div>
      </div>
    </div>
  );
} 