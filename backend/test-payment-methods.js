// 测试不同货币的支付方式配置
const getPaymentMethods = (currency = 'usd') => {
  // 基础支付方式（全球通用）
  const baseMethods = ['card'];
  
  // 根据货币添加特定支付方式
  if (currency === 'eur') {
    // 欧元区支付方式
    return [...baseMethods, 'sepa_debit', 'ideal', 'sofort', 'bancontact'];
  } else if (currency === 'usd') {
    // 美元区支付方式
    return [...baseMethods, 'us_bank_account'];
  } else if (currency === 'gbp') {
    // 英镑区支付方式
    return [...baseMethods, 'bacs_debit'];
  } else if (currency === 'jpy') {
    // 日元区支付方式
    return [...baseMethods, 'konbini'];
  } else if (currency === 'aud') {
    // 澳元区支付方式
    return [...baseMethods, 'au_becs_debit'];
  } else if (currency === 'cad') {
    // 加元区支付方式
    return [...baseMethods, 'acss_debit'];
  }
  
  // 默认只使用信用卡
  return baseMethods;
};

console.log('🌍 Stripe支付方式配置测试\n');

const currencies = ['usd', 'eur', 'gbp', 'jpy', 'aud', 'cad'];

currencies.forEach(currency => {
  const methods = getPaymentMethods(currency);
  console.log(`${currency.toUpperCase()}: ${methods.join(', ')}`);
});

console.log('\n📋 支付方式说明:');
console.log('💳 card: 信用卡/借记卡 (全球通用)');
console.log('🏦 sepa_debit: 欧洲银行转账 (EUR)');
console.log('🇳🇱 ideal: 荷兰在线银行 (EUR)');
console.log('🇩🇪 sofort: 德国即时转账 (EUR)');
console.log('🇧🇪 bancontact: 比利时银行卡 (EUR)');
console.log('🇺🇸 us_bank_account: 美国银行账户 (USD)');
console.log('🇬🇧 bacs_debit: 英国银行转账 (GBP)');
console.log('🇯🇵 konbini: 日本便利店支付 (JPY)');
console.log('🇦🇺 au_becs_debit: 澳大利亚银行转账 (AUD)');
console.log('🇨🇦 acss_debit: 加拿大银行转账 (CAD)');

console.log('\n🔧 配置方法:');
console.log('1. 在.env文件中设置 STRIPE_CURRENCY=eur');
console.log('2. 在Stripe Dashboard中创建对应货币的价格');
console.log('3. 重启服务器应用配置');
