/**
 * 将 express-validator 的 errors.array() 映射为带 i18n 错误码的结构，供前端多语言展示
 * @param {Array} errors - validationResult(req).array()
 * @returns {Array<{param, code, msg, ...}>}
 */
function mapValidationErrorsToCodes(errors) {
  const pathToCode = {
    content_id: (msg) => msg && msg.includes('UUID') ? 'CONTENT_ID_INVALID' : 'CONTENT_ID_INVALID',
    knowledge_point: (msg) => msg && msg.includes('不能为空') ? 'KNOWLEDGE_POINT_INVALID' : 'KNOWLEDGE_POINT_INVALID',
    knowledgePoint: (msg) => 'KNOWLEDGE_POINT_INVALID',
    output_type: (msg) => 'OUTPUT_TYPE_INVALID',
    description: (msg) => msg && msg.includes('1500') ? 'DESCRIPTION_TOO_LONG' : 'DESCRIPTION_INVALID',
    language_code: (msg) => 'LANGUAGE_CODE_INVALID',
    provider: (msg) => 'PROVIDER_INVALID',
    idempotency_key: (msg) => msg && msg.includes('不合法') ? 'IDEMPOTENCY_KEY_INVALID' : 'IDEMPOTENCY_KEY_INVALID',
    requestId: (msg) => 'REQUEST_ID_INVALID',
    image: (msg) => {
      if (msg && msg.includes('mime_type')) return 'IMAGE_MIME_TYPE_INVALID';
      if (msg && msg.includes('data')) return 'IMAGE_DATA_INVALID';
      if (msg && msg.includes('格式')) return 'IMAGE_FORMAT_UNSUPPORTED';
      return 'IMAGE_INVALID';
    }
  };

  return errors.map(e => {
    const path = e.path || e.param;
    const getCode = pathToCode[path] || (() => 'VALIDATION_ERROR');
    const code = typeof getCode === 'function' ? getCode(e.msg) : getCode;
    return {
      param: path,
      code,
      msg: e.msg,
      type: e.type,
      value: e.value
    };
  });
}

module.exports = { mapValidationErrorsToCodes };
