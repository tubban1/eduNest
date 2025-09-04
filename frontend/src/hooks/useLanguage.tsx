import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 支持的语言
export type Language = 'en' | 'fr' | 'de' | 'zh';

// 语言配置
const languageConfig = {
  en: {
    locale: 'en',
    name: 'English',
    flag: '🇺🇸',
  },
  fr: {
    locale: 'fr',
    name: 'Français',
    flag: '🇫🇷',
  },
  de: {
    locale: 'de',
    name: 'Deutsch',
    flag: '🇩🇪',
  },
  zh: {
    locale: 'zh',
    name: '中文',
    flag: '🇨🇳',
  },
};

// 翻译内容
const translations = {
  en: {
    // 通用
    common: {
      cancel: 'Cancel',
      retry: 'Retry',
      loading: 'Loading...',
      locale: 'en',
    },
    // 订阅
    subscription: {
      plan: {
        pro: {
          title: 'Pro Plan',
          description: 'Unlimited AI usage, priority support, advanced features',
        },
      },
      checkout: {
        title: 'Complete Your Subscription',
        subtitle: 'Choose your payment method and complete your subscription',
      },
    },
    // 支付
    payment: {
      subscribe: 'Subscribe Now',
      processing: 'Processing...',
      loading: 'Setting up payment...',
      error: {
        generic: 'Payment failed. Please try again.',
        session_creation: 'Failed to create payment session',
        network: 'Network error. Please check your connection.',
        no_session: 'No payment session available',
      },
      security: {
        notice: 'Your payment information is secure and encrypted',
      },
    },
  },
  fr: {
    common: {
      cancel: 'Annuler',
      retry: 'Réessayer',
      loading: 'Chargement...',
      locale: 'fr',
    },
    subscription: {
      plan: {
        pro: {
          title: 'Plan Pro',
          description: 'Utilisation illimitée de l\'IA, support prioritaire, fonctionnalités avancées',
        },
      },
      checkout: {
        title: 'Finalisez Votre Abonnement',
        subtitle: 'Choisissez votre méthode de paiement et finalisez votre abonnement',
      },
    },
    payment: {
      subscribe: 'S\'abonner Maintenant',
      processing: 'Traitement...',
      loading: 'Configuration du paiement...',
      error: {
        generic: 'Paiement échoué. Veuillez réessayer.',
        session_creation: 'Échec de la création de la session de paiement',
        network: 'Erreur réseau. Vérifiez votre connexion.',
        no_session: 'Aucune session de paiement disponible',
      },
      security: {
        notice: 'Vos informations de paiement sont sécurisées et chiffrées',
      },
    },
  },
  de: {
    common: {
      cancel: 'Abbrechen',
      retry: 'Wiederholen',
      loading: 'Laden...',
      locale: 'de',
    },
    subscription: {
      plan: {
        pro: {
          title: 'Pro-Plan',
          description: 'Unbegrenzte KI-Nutzung, Prioritäts-Support, erweiterte Funktionen',
        },
      },
      checkout: {
        title: 'Ihr Abonnement Abschließen',
        subtitle: 'Wählen Sie Ihre Zahlungsmethode und schließen Sie Ihr Abonnement ab',
      },
    },
    payment: {
      subscribe: 'Jetzt Abonnieren',
      processing: 'Verarbeitung...',
      loading: 'Zahlung wird eingerichtet...',
      error: {
        generic: 'Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.',
        session_creation: 'Fehler beim Erstellen der Zahlungssitzung',
        network: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.',
        no_session: 'Keine Zahlungssitzung verfügbar',
      },
      security: {
        notice: 'Ihre Zahlungsinformationen sind sicher und verschlüsselt',
      },
    },
  },
  zh: {
    common: {
      cancel: '取消',
      retry: '重试',
      loading: '加载中...',
      locale: 'zh',
    },
    subscription: {
      plan: {
        pro: {
          title: '专业版',
          description: '无限AI使用，优先支持，高级功能',
        },
      },
      checkout: {
        title: '完成订阅',
        subtitle: '选择支付方式并完成订阅',
      },
    },
    payment: {
      subscribe: '立即订阅',
      processing: '处理中...',
      loading: '正在设置支付...',
      error: {
        generic: '支付失败，请重试。',
        session_creation: '创建支付会话失败',
        network: '网络错误，请检查连接。',
        no_session: '没有可用的支付会话',
      },
      security: {
        notice: '您的支付信息是安全且加密的',
      },
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  availableLanguages: typeof languageConfig;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译函数
function translate(key: string, language: Language): string {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果找不到翻译，返回英文版本
      value = keys.reduce((obj, k) => obj?.[k], translations.en);
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // 从localStorage获取用户语言偏好
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && languageConfig[savedLanguage]) {
      setLanguageState(savedLanguage);
    } else {
      // 检测浏览器语言
      const browserLang = navigator.language.split('-')[0] as Language;
      if (languageConfig[browserLang]) {
        setLanguageState(browserLang);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    // 设置HTML lang属性
    document.documentElement.lang = lang;
  };

  const t = (key: string) => translate(key, language);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    availableLanguages: languageConfig,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
