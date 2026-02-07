/**
 * 知识库 Embedding 服务
 * 使用 OpenAI text-embedding-3-small，API Key 从 GPT_REALTIME_API_KEY 读取
 * 可选：OPENAI_EMBEDDING_BASE_URL 指向代理（如 hrqdapi.cn）时使用
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const OpenAI = require('openai').default;
const logger = require('../utils/logger');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const MAX_INPUT_LENGTH = 8000;

let _client = null;

// 使用 hrqdapi.cn 时 embedding 端点：POST https://hrqdapi.cn/v1/embeddings
const DEFAULT_EMBEDDING_BASE_URL = 'https://hrqdapi.cn/v1';

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.GPT_REALTIME_API_KEY;
  if (!apiKey || apiKey === 'your-realtime-api-key-here') {
    throw new Error('GPT_REALTIME_API_KEY 未配置，无法调用 embedding API');
  }
  const baseURL = process.env.OPENAI_EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE_URL;
  _client = new OpenAI({
    apiKey,
    baseURL,
  });
  return _client;
}

/**
 * 单条文本生成 embedding 向量
 * @param {string} text - 待向量化的文本
 * @returns {Promise<number[]>} 1536 维向量
 */
async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('getEmbedding 需要非空字符串');
  }
  const truncated = text.slice(0, MAX_INPUT_LENGTH);
  const client = getClient();
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
  });
  let vec = res.data?.[0]?.embedding;
  if (vec && Array.isArray(vec)) return vec;
  if (res.data?.[0] && Array.isArray(res.data[0])) vec = res.data[0];
  if (res.embedding && Array.isArray(res.embedding)) vec = res.embedding;
  if (res.data && Array.isArray(res.data) && res.data.length > 0 && typeof res.data[0] === 'number') vec = res.data;
  if (!vec || !Array.isArray(vec)) {
    logger.warn('[kbEmbedding] 响应结构非常规', { keys: Object.keys(res || {}), dataKeys: res?.data ? Object.keys(res.data) : null, firstItem: res?.data?.[0] ? Object.keys(res.data[0]) : null });
    throw new Error('Embedding API 返回格式异常');
  }
  return vec;
}

/**
 * 将 kb_entry 的 title + content（或 question + answer）拼成文本并生成 embedding
 * @param {Object} entry - { title?, content?, question?, answer? }
 * @returns {Promise<number[]>}
 */
async function embedEntry(entry) {
  const parts = [
    entry.title,
    entry.content,
    entry.question,
    entry.answer,
  ].filter(Boolean);
  const textToEmbed = parts.join('\n\n');
  return getEmbedding(textToEmbed);
}

module.exports = {
  getEmbedding,
  embedEntry,
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
};
