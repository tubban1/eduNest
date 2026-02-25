const DEFAULT_BASE_URL = (process.env.VECTORENGINE_URL || 'https://api.vectorengine.ai').replace(/\/$/, '');
const DEFAULT_MODEL = process.env.VECTORENGINE_MODEL || 'gpt-4o-mini-audio-preview';

async function chatWithAudio({
  messages,
  voice = 'alloy',
  format = 'wav',
  modalities = ['text', 'audio'],
  timeoutMs = 45000,
  model,
}) {
  const apiKey = process.env.VECTORENGINE_API_KEY;
  if (!apiKey) {
    throw new Error('VECTORENGINE_API_KEY 未配置');
  }

  const endpoint = `${DEFAULT_BASE_URL}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    model: model || DEFAULT_MODEL,
    modalities,
    audio: modalities.includes('audio') ? { voice, format } : undefined,
    messages,
    stream: false,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`VectorEngine 错误: ${response.status} - ${raw}`);
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error('VectorEngine 返回非 JSON');
    }

    const choice = json?.choices?.[0]?.message || json?.choices?.[0];
    const text =
      choice?.audio?.transcript ||
      choice?.content ||
      json?.output_text ||
      null;

    const audioData =
      choice?.audio?.data ||
      json?.audio?.data ||
      json?.data?.audio?.data ||
      null;

    return {
      raw: json,
      text: text ? String(text) : null,
      audio: audioData
        ? {
            format,
            mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
            data: audioData,
          }
        : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  chatWithAudio,
};
