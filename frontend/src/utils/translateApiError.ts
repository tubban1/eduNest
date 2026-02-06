import i18n from '@/i18n/config';

/** 后端错误码到 i18n key 的映射 */
const ERROR_CODE_TO_KEY: Record<string, string> = {
  PARAM_VALIDATION_FAILED: 'paramValidationFailed',
  INSUFFICIENT_CREDITS: 'insufficientCredits',
  CONTENT_NOT_FOUND: 'contentNotFound',
  OUTPUT_TYPE_INVALID: 'outputTypeInvalid',
  FREE_TRIAL_USED: 'freeTrialUsed',
};

/** detail.code 到 i18n key 的映射 */
const DETAIL_CODE_TO_KEY: Record<string, string> = {
  DESCRIPTION_TOO_LONG: 'descriptionTooLong',
  KNOWLEDGE_POINT_INVALID: 'knowledgePointInvalid',
  CONTENT_ID_INVALID: 'contentIdInvalid',
  OUTPUT_TYPE_INVALID: 'outputTypeInvalid',
  LANGUAGE_CODE_INVALID: 'languageCodeInvalid',
  PROVIDER_INVALID: 'providerInvalid',
  IDEMPOTENCY_KEY_INVALID: 'idempotencyKeyInvalid',
  IMAGE_MIME_TYPE_INVALID: 'imageMimeTypeInvalid',
  IMAGE_DATA_INVALID: 'imageDataInvalid',
  IMAGE_FORMAT_UNSUPPORTED: 'imageFormatUnsupported',
  IMAGE_INVALID: 'invalidImageType',
  REQUEST_ID_INVALID: 'requestIdInvalid',
  VALIDATION_ERROR: 'validationError',
};

/**
 * 将后端返回的错误码和 details 翻译为当前语言的错误信息
 * @param error - 捕获的 API 错误（含 errorCode、details）
 * @param contextKey - 上下文 key，如 'submitGenerateFailed'
 * @returns 翻译后的完整错误信息
 */
export function translateApiError(error: any, contextKey: string): string {
  const t = i18n.t.bind(i18n);
  const ns = 'content';

  const contextMsg = t(`${ns}:errors.${contextKey}`, { defaultValue: contextKey });

  const errorCode = error?.errorCode;
  const details = Array.isArray(error?.details) ? error.details : [];

  // 优先根据 errorCode 获取主错误信息
  const mainKey = errorCode && ERROR_CODE_TO_KEY[errorCode];
  const mainMsg = mainKey
    ? t(`${ns}:errors.${mainKey}`, { defaultValue: error?.message })
    : (error?.message || '');

  if (details.length === 0) {
    return mainMsg ? `${contextMsg}: ${mainMsg}` : contextMsg;
  }

  // 翻译每个 detail
  const translatedDetails = details.map((d: any) => {
    const code = d?.code;
    const key = code && DETAIL_CODE_TO_KEY[code];
    if (key) {
      return t(`${ns}:errors.${key}`, { max: 1500, defaultValue: d?.msg || d?.param });
    }
    return d?.msg || d?.param || '';
  }).filter(Boolean);

  const detailsStr = translatedDetails.join('\n');
  return mainMsg ? `${contextMsg}: ${mainMsg}\n${detailsStr}` : `${contextMsg}\n${detailsStr}`;
}
