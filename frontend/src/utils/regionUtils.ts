// 地区检测和支付方式适配工具

export interface Region {
  code: string;
  name: string;
  currency: string;
  paymentMethods: string[];
  timezone: string;
  locale: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  region: string;
  description: string;
}

// 重点地区配置
export const REGIONS: Record<string, Region> = {
  // 瑞士
  'CH': {
    code: 'CH',
    name: '瑞士',
    currency: 'CHF',
    paymentMethods: ['card', 'sepa_debit', 'sofort'],
    timezone: 'Europe/Zurich',
    locale: 'de-CH'
  },
  // 美国
  'US': {
    code: 'US',
    name: '美国',
    currency: 'USD',
    paymentMethods: ['card', 'us_bank_account'],
    timezone: 'America/New_York',
    locale: 'en-US'
  },
  // 中国
  'CN': {
    code: 'CN',
    name: '中国',
    currency: 'CNY',
    paymentMethods: ['card', 'alipay', 'wechat_pay'],
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN'
  },
  // 欧洲主要国家
  'DE': {
    code: 'DE',
    name: '德国',
    currency: 'EUR',
    paymentMethods: ['card', 'sepa_debit', 'sofort', 'giropay'],
    timezone: 'Europe/Berlin',
    locale: 'de-DE'
  },
  'FR': {
    code: 'FR',
    name: '法国',
    currency: 'EUR',
    paymentMethods: ['card', 'sepa_debit', 'bancontact'],
    timezone: 'Europe/Paris',
    locale: 'fr-FR'
  },
  'NL': {
    code: 'NL',
    name: '荷兰',
    currency: 'EUR',
    paymentMethods: ['card', 'sepa_debit', 'ideal'],
    timezone: 'Europe/Amsterdam',
    locale: 'nl-NL'
  },
  'IT': {
    code: 'IT',
    name: '意大利',
    currency: 'EUR',
    paymentMethods: ['card', 'sepa_debit'],
    timezone: 'Europe/Rome',
    locale: 'it-IT'
  },
  'ES': {
    code: 'ES',
    name: '西班牙',
    currency: 'EUR',
    paymentMethods: ['card', 'sepa_debit'],
    timezone: 'Europe/Madrid',
    locale: 'es-ES'
  },
  'GB': {
    code: 'GB',
    name: '英国',
    currency: 'GBP',
    paymentMethods: ['card', 'bacs_debit'],
    timezone: 'Europe/London',
    locale: 'en-GB'
  }
};

// 支付方式详细配置
export const PAYMENT_METHODS: Record<string, PaymentMethod> = {
  card: {
    id: 'card',
    name: '信用卡/借记卡',
    region: 'global',
    description: 'Visa, Mastercard, American Express等'
  },
  sepa_debit: {
    id: 'sepa_debit',
    name: '欧洲银行转账',
    region: 'EU',
    description: 'SEPA直接借记，适用于欧元区'
  },
  sofort: {
    id: 'sofort',
    name: '德国即时转账',
    region: 'DE',
    description: '德国流行的在线银行转账'
  },
  giropay: {
    id: 'giropay',
    name: '德国银行转账',
    region: 'DE',
    description: '德国银行间转账系统'
  },
  ideal: {
    id: 'ideal',
    name: '荷兰在线银行',
    region: 'NL',
    description: '荷兰在线银行支付'
  },
  bancontact: {
    id: 'bancontact',
    name: '比利时银行卡',
    region: 'BE',
    description: '比利时银行卡支付'
  },
  us_bank_account: {
    id: 'us_bank_account',
    name: '美国银行账户',
    region: 'US',
    description: 'ACH银行转账'
  },
  bacs_debit: {
    id: 'bacs_debit',
    name: '英国银行转账',
    region: 'GB',
    description: 'BACS直接借记'
  },
  alipay: {
    id: 'alipay',
    name: '支付宝',
    region: 'CN',
    description: '中国支付宝支付'
  },
  wechat_pay: {
    id: 'wechat_pay',
    name: '微信支付',
    region: 'CN',
    description: '中国微信支付'
  }
};

// 检测用户地区
export const detectUserRegion = (): Region => {
  try {
    // 1. 尝试从浏览器语言检测
    const browserLocale = navigator.language || navigator.languages?.[0];
    if (browserLocale) {
      const countryCode = browserLocale.split('-')[1]?.toUpperCase();
      if (countryCode && REGIONS[countryCode]) {
        return REGIONS[countryCode];
      }
    }

    // 2. 尝试从时区检测
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const region of Object.values(REGIONS)) {
      if (region.timezone === timezone) {
        return region;
      }
    }

    // 3. 尝试从货币检测
    const currency = Intl.NumberFormat().resolvedOptions().currency;
    if (currency) {
      for (const region of Object.values(REGIONS)) {
        if (region.currency === currency) {
          return region;
        }
      }
    }

    // 4. 默认返回美国
    return REGIONS['US'];
  } catch (error) {
    console.warn('地区检测失败，使用默认地区:', error);
    return REGIONS['US'];
  }
};

// 获取地区支持的支付方式
export const getRegionPaymentMethods = (regionCode: string): PaymentMethod[] => {
  const region = REGIONS[regionCode];
  if (!region) {
    return [PAYMENT_METHODS.card]; // 默认只支持信用卡
  }

  return region.paymentMethods
    .map(methodId => PAYMENT_METHODS[methodId])
    .filter(Boolean);
};

// 获取所有可用支付方式（用于选择器）
export const getAllAvailablePaymentMethods = (): PaymentMethod[] => {
  const userRegion = detectUserRegion();
  const regionMethods = getRegionPaymentMethods(userRegion.code);
  
  // 添加全球通用的信用卡
  const globalMethods = [PAYMENT_METHODS.card];
  
  // 合并并去重
  const allMethods = [...globalMethods, ...regionMethods];
  const uniqueMethods = allMethods.filter((method, index, self) => 
    index === self.findIndex(m => m.id === method.id)
  );
  
  return uniqueMethods;
};

// 格式化货币显示
export const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount}`;
  }
};

// 获取地区显示名称（兼容旧逻辑，仅限 REGIONS 内）
export const getRegionDisplayName = (regionCode: string): string => {
  return REGIONS[regionCode]?.name || regionCode;
};

/** 按当前界面语言显示国家/地区名（全量列表用），使用 Intl.DisplayNames */
export function getRegionDisplayNameI18n(regionCode: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    return dn.of(regionCode) ?? regionCode;
  } catch {
    return regionCode;
  }
}

/** 国家/地区代码 → 应用支持的 locale（选地区时可自动带出语言） */
export const REGION_DEFAULT_LOCALE: Record<string, string> = {
  CN: 'zh-CN', HK: 'zh-CN', TW: 'zh-CN', MO: 'zh-CN',
  US: 'en-US', GB: 'en-US', AU: 'en-US', CA: 'en-US', IE: 'en-US', IN: 'en-US', SG: 'en-US',
  DE: 'de-DE', AT: 'de-DE', CH: 'de-DE', LI: 'de-DE',
  FR: 'fr-FR', BE: 'fr-FR', LU: 'fr-FR', MC: 'fr-FR',
  NL: 'nl-NL', IT: 'it-IT', ES: 'es-ES', PT: 'pt-PT', BR: 'pt-BR', JP: 'ja-JP', KR: 'ko-KR',
};

/** 根据浏览器语言前 2 字符匹配应用 locale（zh→中文, en→English, …） */
export function getLocaleFromBrowser(): string {
  if (typeof navigator === 'undefined') return 'en-US';
  const raw = navigator.language || (navigator as any).languages?.[0] || '';
  const prefix = raw.slice(0, 2).toLowerCase();
  const map: Record<string, string> = {
    zh: 'zh-CN', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
    nl: 'nl-NL', it: 'it-IT', es: 'es-ES', pt: 'pt-PT', ja: 'ja-JP', ko: 'ko-KR',
  };
  return map[prefix] || 'en-US';
}

// 检查支付方式是否在地区可用
export const isPaymentMethodAvailable = (methodId: string, regionCode: string): boolean => {
  const region = REGIONS[regionCode];
  if (!region) return false;
  
  return region.paymentMethods.includes(methodId);
};
