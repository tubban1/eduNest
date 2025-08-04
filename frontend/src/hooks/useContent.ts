"use client"

import { useState, useEffect } from 'react'
import { api, Content } from '@/lib/api'

interface Filters {
  knowledge_point?: string[]
  language?: string
}

export function useContent() {
  const [content, setContent] = useState<Content[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContent = async (filters?: Filters) => {
    setLoading(true)
    setError(null)
    
    try {
      let data: Content[]
      if (filters && Object.keys(filters).length > 0) {
        data = await api.content.getFiltered(filters)
      } else {
        data = await api.content.getAll()
      }
      setContent(data)
    } catch (err) {
      // 静默处理错误
    } finally {
      setLoading(false)
    }
  }

  const createContent = async (content: Omit<Content, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newContent = await api.content.create(content)
      if (newContent) {
        setContent(prev => [newContent, ...prev])
      }
      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '创建内容失败' }
    }
  }

  const updateContent = async (id: string, updates: Partial<Content>) => {
    try {
      const updatedContent = await api.content.update(id, updates)
      if (updatedContent) {
        setContent(prev => 
          prev.map(content => 
            content.id === id ? updatedContent : content
          )
        )
      }
      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '更新内容失败' }
    }
  }

  const deleteContent = async (id: string) => {
    try {
      await api.content.delete(id)
      setContent(prev => prev.filter(content => content.id !== id))
      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '删除内容失败' }
    }
  }

  const getContentById = async (id: string) => {
    try {
      return await api.content.getById(id)
    } catch (err) {
      return null
    }
  }

  useEffect(() => {
    fetchContent()
  }, [])

  return {
    content,
    loading,
    error,
    fetchContent,
    createContent,
    updateContent,
    deleteContent,
    getContentById,
  }
} 