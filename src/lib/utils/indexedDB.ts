/**
 * IndexedDB 缓存工具
 *
 * 功能：
 * - 缓存单词释义数据，避免重复网络请求
 * - 自动过期机制（7天）
 * - 提供简单的 get/set/delete 接口
 */

import type { WordDefinition } from './wordTranslation'

const DB_NAME = 'shadowhub-cache'
const DB_VERSION = 1
const STORE_NAME = 'word-definitions'
const CACHE_EXPIRY_DAYS = 7 // 缓存有效期：7天

interface CacheEntry {
  word: string
  definition: WordDefinition
  timestamp: number
}

class IndexedDBCache {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('[IndexedDB] Database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'word' })
          console.log('[IndexedDB] Object store created')
        }
      }
    })

    return this.initPromise
  }

  /**
   * 获取单词定义（从缓存）
   */
  async get(word: string): Promise<WordDefinition | null> {
    await this.init()

    if (!this.db) {
      console.warn('[IndexedDB] Database not initialized')
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.get(word)

      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result

        if (!entry) {
          resolve(null)
          return
        }

        // 检查是否过期
        const ageInDays = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24)
        if (ageInDays > CACHE_EXPIRY_DAYS) {
          console.log(`[IndexedDB] Cache expired for: ${word}`)
          this.delete(word).catch(console.error)
          resolve(null)
          return
        }

        console.log(`[IndexedDB] Cache hit for: ${word}`)
        resolve(entry.definition)
      }

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 保存单词定义（到缓存）
   */
  async set(word: string, definition: WordDefinition): Promise<void> {
    await this.init()

    if (!this.db) {
      console.warn('[IndexedDB] Database not initialized')
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)

      const entry: CacheEntry = {
        word,
        definition,
        timestamp: Date.now()
      }

      const request = objectStore.put(entry)

      request.onsuccess = () => {
        console.log(`[IndexedDB] Cached: ${word}`)
        resolve()
      }

      request.onerror = () => {
        console.error('[IndexedDB] Failed to set:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 删除单词定义
   */
  async delete(word: string): Promise<void> {
    await this.init()

    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.delete(word)

      request.onsuccess = () => {
        console.log(`[IndexedDB] Deleted: ${word}`)
        resolve()
      }

      request.onerror = () => {
        console.error('[IndexedDB] Failed to delete:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this.init()

    if (!this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.clear()

      request.onsuccess = () => {
        console.log('[IndexedDB] All cache cleared')
        resolve()
      }

      request.onerror = () => {
        console.error('[IndexedDB] Failed to clear:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 获取缓存大小（条目数）
   */
  async count(): Promise<number> {
    await this.init()

    if (!this.db) {
      return 0
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        console.error('[IndexedDB] Failed to count:', request.error)
        reject(request.error)
      }
    })
  }
}

// 导出单例
export const wordCache = new IndexedDBCache()
