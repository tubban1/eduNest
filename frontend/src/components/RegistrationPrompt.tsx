'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

interface RegistrationPromptProps {
  type: 'generation' | 'aiGuide' | 'trialUsed';
  onRegister: () => void;
  onDismiss?: () => void;
  visible: boolean;
}

export const RegistrationPrompt: React.FC<RegistrationPromptProps> = ({
  type,
  onRegister,
  onDismiss,
  visible,
}) => {
  const { t } = useTranslation(['common', 'auth']);
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!visible || !mounted) return null;

  const handleRegister = () => {
    onRegister();
    router.push('/signup');
  };

  const getTitle = () => {
    switch (type) {
      case 'generation':
        return mounted ? t('registrationPrompt.generationTitle', { ns: 'common', defaultValue: '🎉 内容生成成功！' }) : '🎉 内容生成成功！';
      case 'aiGuide':
        return mounted ? t('registrationPrompt.aiGuideTitle', { ns: 'common', defaultValue: '💬 对话完成！' }) : '💬 对话完成！';
      case 'trialUsed':
        return mounted ? t('registrationPrompt.trialUsedTitle', { ns: 'common', defaultValue: '请登录后继续使用' }) : '请登录后继续使用';
      default:
        return '';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'generation':
        return mounted ? t('registrationPrompt.generationMessage', { ns: 'common', defaultValue: '登录后继续免费生成更多内容' }) : '登录后继续免费生成更多内容';
      case 'aiGuide':
        return mounted ? t('registrationPrompt.aiGuideMessage', { ns: 'common', defaultValue: '登录后继续免费使用 AI Guide' }) : '登录后继续免费使用 AI Guide';
      case 'trialUsed':
        return mounted ? t('registrationPrompt.trialUsedMessage', { ns: 'common', defaultValue: '注册账号以继续使用功能' }) : '注册账号以继续使用功能';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 flex items-center justify-center z-50" onClick={onDismiss}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {getTitle()}
          </h3>
          <p className="text-muted-foreground whitespace-pre-line">
            {getMessage()}
          </p>
        </div>
        <div className="flex gap-3 justify-center mt-6">
          {onDismiss && type !== 'trialUsed' && (
            <button
              className="tile button"
              onClick={onDismiss}
            >
              <div className="tile up px-6 py-2 font-medium">
                {mounted ? t('registrationPrompt.later', { ns: 'common', defaultValue: '稍后再说' }) : '稍后再说'}
              </div>
            </button>
          )}
          <button
            className="tile button"
            onClick={handleRegister}
          >
            <div className="tile up px-6 py-2 font-semibold">
              {mounted ? t('registrationPrompt.registerNow', { ns: 'common', defaultValue: '立即注册' }) : '立即注册'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

