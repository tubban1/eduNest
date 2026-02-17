/**
 * ISO 3166-1 alpha-2 国家/地区代码全量列表。
 * 展示名通过 Intl.DisplayNames(locale, { type: 'region' }).of(code) 按当前语言显示。
 */

/** 优先展示的地区（onboard 等下拉框靠前） */
export const PRIORITY_REGION_CODES = [
  'CN',
  'US',
  'GB',
  'DE',
  'FR',
  'CH',
  'NL',
  'IT',
  'ES',
  'CA',
  'AU',
  'JP',
  'KR',
  'IN',
  'SG',
  'HK',
  'TW',
  'AT',
  'BE',
  'PT',
] as const;

/** 其余 ISO 3166-1 alpha-2 代码（不含 PRIORITY，按字母序） */
const REMAINING_REGION_CODES = [
  'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'KY', 'CF', 'TD', 'CL', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HU', 'IS', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'JM', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'LK', 'SD', 'SR', 'SE', 'SY', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'AX',
].filter((c) => !PRIORITY_REGION_CODES.includes(c as typeof PRIORITY_REGION_CODES[number]));

/** 用于下拉的完整列表：优先项靠前 + 其余按字母序 */
export function getOrderedRegionCodes(): string[] {
  return [...PRIORITY_REGION_CODES, ...REMAINING_REGION_CODES.sort()];
}
