const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('../config');

// 确保环境变量在验证之前加载
require('dotenv').config({ path: '/Users/wahaha/Documents/Me/Project/cursor/edu/.env' });

// Supabase 配置验证
const validateSupabaseConfig = () => {
  const requiredConfigs = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];
  
  const missingConfigs = requiredConfigs.filter(config => 
    !process.env[config] || process.env[config] === `your_${config.toLowerCase()}`
  );
  
  if (missingConfigs.length > 0) {
    // 缺少 Supabase 配置，在开发模式下将使用模拟数据
  }
  
  return true;
};

// 创建 Supabase 客户端
let supabase = null;
let useMockData = false;

try {
  const isValidConfig = validateSupabaseConfig();
  if (isValidConfig) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  } else {
    useMockData = true;
  }
} catch (error) {
  console.error('❌ Supabase 客户端初始化失败:', error.message);
  useMockData = true;
}

// 模拟数据（开发模式）
const mockData = {
  users: [
    {
      id: 'mock-user-1',
      email: 'test@example.com',
      name: '测试用户',
      role: 'user'
    }
  ],
  contents: [
    {
      id: 'mock-content-1',
      short_id: 'c1234567',
      title: '示例内容',
      language: 'zh-CN',
      tags: ['示例'],
      knowledge_point: ['测试'],
      created_at: new Date().toISOString()
    }
  ],
  collection_lists: [
    {
      id: 'mock-list-1',
      name: '我的收藏',
      visibility: 'private',
      user_id: 'mock-user-1',
      order_index: 0
    }
  ],
  user_collections: [
    {
      id: 'mock-collection-1',
      user_id: 'mock-user-1',
      content_id: 'mock-content-1',
      list_id: 'mock-list-1',
      added_at: new Date().toISOString()
    }
  ]
};

// 内容相关方法
const getContents = async (filters = {}) => {
  try {
    let query = supabase.from('content').select('*');
    if (filters.knowledge_point) {
      query = query.contains('knowledge_point', [filters.knowledge_point]);
    }
    if (filters.language) {
      query = query.eq('language', filters.language);
    }
    if (filters.tag) {
      query = query.contains('tag', [filters.tag]);
    }
    if (filters.created_by) {
      query = query.eq('created_by', filters.created_by);
    }
    
    // 添加limit支持
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getContentById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getContentByShortId = async (shortId) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('short_id', shortId)
      .single();
    if (error) {
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

function generateShortId() {
  return Math.random().toString(36).slice(2, 10);
}

const createContent = async (contentData, userId) => {
  try {
    const { title, code_html, code_css, code_js, tags, external_links, description, content_type, language } = contentData;
    
    const result = await supabase
      .from('content')
      .insert({
        title, code_html, code_css, code_js, tags, external_links, description, content_type, language,
        created_by: userId,
        short_id: generateShortId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  } catch (error) {
    throw error;
  }
};

const updateContent = async (contentId, contentData) => {
  const {
    title,
    code_html,
    code_css,
    code_js,
    tags,
    external_links,
    description,
    content_type,
    language
  } = contentData;

  const result = await supabase
    .from('content')
    .update({ 
      title,
      code_html,
      code_css,
      code_js,
      tags,
      external_links,
      description,
      content_type,
      language,
      updated_at: new Date().toISOString()
    })
    .eq('id', contentId)
    .select()
    .single();

  if (result.error) {
    // 内容更新失败
    return { success: false, error: result.error };
  }
  return result.data;
};

const deleteContent = async (id) => {
  try {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// 用户相关方法
const getUserByEmail = async (email) => {
  try {
    // 使用 Supabase Auth 的 admin API 获取用户
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      throw error;
    }
    
    // 查找匹配的用户
    const user = data.users.find(u => u.email === email);
    return { data: user, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserById = async (id) => {
  try {
    // 从users表中查询用户信息
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const createUser = async (userData) => {
  try {
    // 使用 Supabase Auth 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });
    
    if (error) {
      throw error;
    }
    
    return { data: data.user, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 收藏相关方法
const getUserCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select(`
        *,
        content (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const addToCollection = async (userId, contentId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .insert({
        user_id: userId,
        content_id: contentId
      })
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const removeFromCollection = async (userId, contentId) => {
  try {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { error: null };
  } catch (error) {
    return { error };
  }
};

// 评分相关方法
const getContentRatings = async (contentId) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const addRating = async (ratingData) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .insert(ratingData)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getRatingStats = async (contentId) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { data: { average: 0, count: 0 }, error: null };
    }
    
    const ratings = data.map(r => r.rating);
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    
    return { 
      data: { 
        average: Math.round(average * 10) / 10, 
        count: ratings.length 
      }, 
      error: null 
    };
  } catch (error) {
    return { data: null, error };
  }
};

// 新增：创建收藏夹
const createCollectionList = async ({ name, visibility = 'private', user_id, order_index = 0 }) => {
  try {
    const now = new Date().toISOString();
    const dataToInsert = {
      name: name.trim(),
      visibility,
      user_id,
      parent_id: null, // 所有列表都是顶级
      order_index,
      created_at: now,
      updated_at: now,
    };
    
    const { data, error } = await supabase
      .from('collection_lists')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 获取用户所有收藏夹
const getCollectionListsByUser = async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('user_id', user_id)
      .is('parent_id', null) // 只获取顶级列表
      .order('order_index', { ascending: true });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 批量更新收藏夹顺序和嵌套
const updateCollectionListOrder = async (orders = []) => {
  try {
    const SPARSE_INTERVAL = 10;
    const MIN_INTERVAL = 0.1;
    
    // 检查是否需要重新排序
    const needsReorder = (siblings) => {
      const indexes = siblings.map(s => s.order_index || 0).sort((a, b) => a - b);
      for (let i = 1; i < indexes.length; i++) {
        if (indexes[i] - indexes[i - 1] < MIN_INTERVAL) {
          return true;
        }
      }
      return false;
    };
    
    // 标准化order_index
    const normalizeOrderIndexes = (siblings) => {
      const sorted = siblings.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      const updates = [];
      
      for (let i = 0; i < sorted.length; i++) {
        const newIndex = (i + 1) * SPARSE_INTERVAL;
        if (newIndex !== (sorted[i].order_index || 0)) {
          updates.push({
            id: sorted[i].id,
            order_index: newIndex,
            parent_id: null // 所有列表都是顶级
          });
        }
      }
      
      return updates;
    };
    
    // 应用传入的orders
    for (const order of orders) {
      const { error } = await supabase
        .from('collection_lists')
        .update({ 
          order_index: order.order_index,
          parent_id: null // 确保所有列表都是顶级
        })
        .eq('id', order.id);
        
      if (error) {
        throw error;
      }
    }
    
    // 检查是否需要重新排序
    const { data: allLists, error: fetchError } = await supabase
      .from('collection_lists')
      .select('*')
      .is('parent_id', null);
      
    if (fetchError) {
      throw fetchError;
    }
    
    if (needsReorder(allLists)) {
      const updates = normalizeOrderIndexes(allLists);
      for (const update of updates) {
        const { error } = await supabase
          .from('collection_lists')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
          
        if (error) {
          throw error;
        }
      }
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

// 删除收藏列表
const deleteCollectionList = async (listId, userId) => {
  try {
    // 验证列表存在且属于当前用户
    const { data: existingList, error: checkError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('id', listId)
      .eq('user_id', userId)
      .is('parent_id', null) // 只删除顶级列表
      .single();
    
    if (checkError || !existingList) {
      throw new Error('列表不存在或无权限删除');
    }
    
    // 删除列表
    const { error: deleteError } = await supabase
      .from('collection_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return { success: true, deleted: listId };
    
  } catch (error) {
    return { success: false, error };
  }
};

const addContentToList = async (userId, contentId, listId) => {
  try {
    // 检查是否已经存在
    const { data: existing, error: checkError } = await supabase
      .from('user_collections')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('list_id', listId)
      .single();
    
    if (existing) {
      return { data: existing, error: null }; // 已经存在，直接返回
    }
    
    const now = new Date().toISOString();
    const dataToInsert = {
      user_id: userId,
      content_id: contentId,
      list_id: listId,
      added_at: now
    };
    
    const { data, error } = await supabase
      .from('user_collections')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const removeContentFromList = async (userId, contentId, listId) => {
  try {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('list_id', listId);
      
    if (error) {
      throw error;
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

const getContentCollections = async (userId, contentId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select(`
        *,
        collection_lists (
          id,
          name,
          visibility
        )
      `)
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserCollectionGroups = async (userId) => {
  try {
    // 从 collection_lists 表获取用户的所有收藏列表
    const { data: lists, error: listsError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null) // 只获取顶级列表
      .order('order_index', { ascending: true });
      
    if (listsError) {
      throw listsError;
    }
    
    // 获取每个列表中的内容数量
    const groups = [];
    for (const list of lists) {
      const { count, error: countError } = await supabase
        .from('user_collections')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id);
      
      if (countError) {
        // 获取列表内容数量失败
        list.contentCount = 0;
      } else {
        list.contentCount = count || 0;
      }
      
      groups.push({
        id: list.id,
        name: list.name,
        count: list.contentCount
      });
    }
    
    // 获取总收藏数量
    let totalCount = 0;
    const { error: totalError } = await supabase
      .from('user_collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (totalError) {
      // 获取总收藏数量失败
      totalCount = 0;
    }
    
    // 添加"全部收藏"分组
    groups.unshift({
      id: 'all',
      name: '全部收藏',
      count: totalCount || 0
    });
    
    return { data: groups, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserCollectionsByGroup = async (userId, groupId) => {
  try {
    let query = supabase
      .from('user_collections')
      .select(`
        id,
        added_at,
        list_id,
        content_id,
        collection_lists (
          id,
          name,
          visibility
        ),
        content (
          id,
          short_id,
          title,
          language,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    
    // 如果不是"全部收藏"，则按列表过滤
    if (groupId !== 'all') {
      query = query.eq('list_id', groupId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // 去重：按content_id分组，保留最新的收藏记录
    const contentMap = new Map();
    data.forEach(item => {
      const contentId = item.content_id;
      if (!contentMap.has(contentId) || 
          new Date(item.added_at) > new Date(contentMap.get(contentId).added_at)) {
        contentMap.set(contentId, item);
      }
    });
    
    // 获取所有内容的喜欢状态
    const contentIds = Array.from(contentMap.keys());
    const { data: likesData, error: likesError } = await supabase
      .from('content_likes')
      .select('content_id')
      .eq('user_id', userId)
      .in('content_id', contentIds);
    
    const likedContentIds = new Set();
    if (!likesError && likesData) {
      likesData.forEach(like => likedContentIds.add(like.content_id));
    }
    
    // 转换数据格式并去重
    const transformedData = Array.from(contentMap.values()).map(item => ({
      id: item.id,
      content: item.content,
      added_at: item.added_at,
      list_id: item.list_id,
      list_name: item.collection_lists?.name || '未命名列表',
      is_liked: likedContentIds.has(item.content_id)
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserLikedCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('content_likes')
      .select(`
        id,
        liked_at,
        content_id,
        content (
          id,
          short_id,
          title,
          language,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('liked_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // 转换数据格式
    const transformedData = data.map(item => ({
      id: item.id,
      content: {
        ...item.content,
        tags: item.content.tags || [] // 使用 tags 字段
      },
      added_at: item.liked_at,
      is_liked: true
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const likeContent = async (userId, contentId) => {
  try {
    
    // 检查是否已经点赞
    const { data: existing, error: checkError } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (existing) {
      return { data: existing, error: null }; // 已经点赞
    }
    
    const now = new Date().toISOString();
    const dataToInsert = {
      user_id: userId,
      content_id: contentId,
      liked_at: now
    };
    
    const { data, error } = await supabase
      .from('content_likes')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const unlikeContent = async (userId, contentId) => {
  try {
    
    // 先检查是否存在喜欢记录
    const { data: existingLike, error: checkError } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (!existingLike) {
      return { success: true, error: null };
    }
    
    const { error } = await supabase
      .from('content_likes')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

// 获取内容的喜欢状态
const getContentLikeStatus = async (userId, contentId) => {
  try {
    
    const { data, error } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    const isLiked = !!data;
    
    return { data: isLiked, error: null };
  } catch (error) {
    return { data: false, error };
  }
};

// 获取用户喜欢的所有内容
const getUserLikedContent = async (userId) => {
  try {
    
    const { data, error } = await supabase
      .from('content_likes')
      .select(`
        id,
        liked_at,
        content (
          id,
          short_id,
          title,
          language,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('liked_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    const transformedData = data.map(item => ({
      id: item.id,
      content: item.content,
      liked_at: item.liked_at,
      is_liked: true
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 检查数据库状态
const checkDatabaseStatus = async () => {
  try {
    // 检查 content 表
    const { data: contentsData, error: contentsError } = await supabase
      .from('content')
      .select('id')
      .limit(1);
    
    if (contentsError) {
      return { success: false, error: contentsError.message };
    }
    
    // 检查 user_collections 表
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('user_collections')
      .select('id')
      .limit(1);
    
    if (collectionsError) {
      return { success: false, error: collectionsError.message };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  supabase,
  useMockData,
  getContents,
  getContentById,
  getContentByShortId,
  createContent,
  updateContent,
  deleteContent,
  getUserByEmail,
  getUserById,
  createUser,
  getUserCollections,
  addToCollection,
  removeFromCollection,
  getContentRatings,
  addRating,
  getRatingStats,
  createCollectionList,
  getCollectionListsByUser,
  updateCollectionListOrder,
  deleteCollectionList,
  addContentToList,
  removeContentFromList,
  getContentCollections,
  getUserCollectionGroups,
  getUserCollectionsByGroup,
  getUserLikedCollections,
  likeContent,
  unlikeContent,
  getContentLikeStatus,
  getUserLikedContent,
  checkDatabaseStatus
}; 