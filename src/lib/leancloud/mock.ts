/**
 * Mock LeanCloud Client for Testing
 *
 * This is a mock implementation for testing without real LeanCloud credentials.
 * It uses localStorage to simulate backend functionality.
 */

export interface MockUser {
  id: string
  email: string
  username: string
  password: string
  avatarUrl?: string
  createdAt: string
}

export interface MockPracticeRecord {
  id: string
  userId: string
  sentenceId: number
  sentenceText: string
  practiceMode: 'dictation' | 'shadowing'
  dictationMode?: 'word' | 'whole'
  isCorrect: boolean
  usedShowWords: boolean
  audioTitle: string
  completedAt: string
}

export interface MockUserStats {
  userId: string
  totalPractices: number
  totalCorrect: number
  todayPractices: number
  lastPracticeDate: string
}

// Storage keys
const STORAGE_KEYS = {
  USERS: 'mock_users',
  CURRENT_USER: 'mock_current_user',
  PRACTICE_RECORDS: 'mock_practice_records',
  USER_STATS: 'mock_user_stats',
}

// Helper functions
const generateId = () => Math.random().toString(36).substr(2, 9)

const getUsers = (): MockUser[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS)
  return data ? JSON.parse(data) : []
}

const saveUsers = (users: MockUser[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users))
}

const getRecords = (): MockPracticeRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PRACTICE_RECORDS)
  return data ? JSON.parse(data) : []
}

const saveRecords = (records: MockPracticeRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.PRACTICE_RECORDS, JSON.stringify(records))
}

const getStats = (): MockUserStats[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USER_STATS)
  return data ? JSON.parse(data) : []
}

const saveStats = (stats: MockUserStats[]) => {
  localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats))
}

// Mock User class
export class MockUserClass {
  id: string
  email: string
  username: string
  private _password: string
  avatarUrl?: string
  createdAt: string

  constructor(data: Partial<MockUser>) {
    this.id = data.id || generateId()
    this.email = data.email || ''
    this.username = data.username || ''
    this._password = data.password || ''
    this.avatarUrl = data.avatarUrl
    this.createdAt = data.createdAt || new Date().toISOString()
  }

  getEmail() {
    return this.email
  }

  getUsername() {
    return this.username
  }

  get(key: string) {
    if (key === 'avatarUrl') return this.avatarUrl
    return undefined
  }

  static async logIn(email: string, password: string) {
    const users = getUsers()
    const user = users.find(u => u.email === email && u.password === password)

    if (!user) {
      throw new Error('Invalid email or password')
    }

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user))
    return new MockUserClass(user)
  }

  static async signUp() {
    const currentUser = this.current()
    if (currentUser) {
      throw new Error('User already logged in')
    }
    return currentUser
  }

  signUp() {
    const users = getUsers()

    // Check if email already exists
    if (users.find(u => u.email === this.email)) {
      throw new Error('Email already taken')
    }

    // Check if username already exists
    if (users.find(u => u.username === this.username)) {
      throw new Error('Username already taken')
    }

    users.push({
      id: this.id,
      email: this.email,
      username: this.username,
      password: this._password,
      avatarUrl: this.avatarUrl,
      createdAt: this.createdAt,
    })

    saveUsers(users)
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({
      id: this.id,
      email: this.email,
      username: this.username,
      avatarUrl: this.avatarUrl,
    }))

    return this
  }

  static current() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    if (!data) return null
    const userData = JSON.parse(data)
    return new MockUserClass(userData)
  }

  static logOut() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
  }
}

// Mock Query class
export class MockQuery {
  private className: string
  private equalConditions: { [key: string]: any } = {}
  private limitCount?: number
  private descendingField?: string

  constructor(className: string) {
    this.className = className
  }

  equalTo(key: string, value: any) {
    this.equalConditions[key] = value
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  descending(field: string) {
    this.descendingField = field
    return this
  }

  async first() {
    if (this.className === 'UserStats') {
      const allStats = getStats()
      const userId = this.equalConditions['user']?.id || this.equalConditions['user']
      return allStats.find(s => s.userId === userId) || null
    }
    return null
  }

  async find() {
    if (this.className === 'PracticeRecord') {
      let records = getRecords()
      const userId = this.equalConditions['user']?.id || this.equalConditions['user']

      // Filter by user
      if (userId) {
        records = records.filter(r => r.userId === userId)
      }

      // Sort by createdAt descending
      if (this.descendingField === 'createdAt') {
        records = records.sort((a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )
      }

      // Limit
      if (this.limitCount) {
        records = records.slice(0, this.limitCount)
      }

      return records.map(r => ({
        id: r.id,
        get: (key: string) => {
          const fieldMap: { [key: string]: any } = {
            sentenceId: r.sentenceId,
            sentenceText: r.sentenceText,
            practiceMode: r.practiceMode,
            dictationMode: r.dictationMode,
            isCorrect: r.isCorrect,
            usedShowWords: r.usedShowWords,
            audioTitle: r.audioTitle,
            completedAt: new Date(r.completedAt),
            createdAt: new Date(r.completedAt),
          }
          return fieldMap[key]
        },
      }))
    }

    return []
  }
}

// Mock Object class
export class MockObject {
  private className: string
  private data: { [key: string]: any } = {}
  private acl?: any

  constructor(className: string) {
    this.className = className
  }

  set(key: string, value: any) {
    this.data[key] = value
    return this
  }

  setACL(acl: any) {
    this.acl = acl
    return this
  }

  async save() {
    if (this.className === 'PracticeRecord') {
      const user = this.data['user']
      const userId = user?.id || user

      const record: MockPracticeRecord = {
        id: generateId(),
        userId,
        sentenceId: this.data['sentenceId'],
        sentenceText: this.data['sentenceText'],
        practiceMode: this.data['practiceMode'],
        dictationMode: this.data['dictationMode'],
        isCorrect: this.data['isCorrect'],
        usedShowWords: this.data['usedShowWords'] || false,
        audioTitle: this.data['audioTitle'],
        completedAt: this.data['completedAt']
          ? new Date(this.data['completedAt']).toISOString()
          : new Date().toISOString(),
      }

      const records = getRecords()
      records.push(record)
      saveRecords(records)

      // Update stats
      updateUserStats(userId)
    }

    return this
  }
}

// Helper function to update user stats
function updateUserStats(userId: string) {
  const records = getRecords().filter(r => r.userId === userId)
  const total = records.length
  const correct = records.filter(r => r.isCorrect).length

  const today = new Date().toISOString().split('T')[0]
  const todayRecords = records.filter(r => r.completedAt.startsWith(today))

  const stats = getStats()
  const existingStats = stats.find(s => s.userId === userId)

  if (existingStats) {
    existingStats.totalPractices = total
    existingStats.totalCorrect = correct
    existingStats.todayPractices = todayRecords.length
    existingStats.lastPracticeDate = today
  } else {
    stats.push({
      userId,
      totalPractices: total,
      totalCorrect: correct,
      todayPractices: todayRecords.length,
      lastPracticeDate: today,
    })
  }

  saveStats(stats)
}

// Mock ACL class
export class MockACL {
  setPublicReadAccess(_: boolean) {
    return this
  }

  setPublicWriteAccess(_: boolean) {
    return this
  }
}

// Main AV object
export const AV = {
  User: MockUserClass,
  Query: MockQuery,
  Object: MockObject,
  ACL: MockACL,
  init() {
    console.log('Mock LeanCloud initialized')
  },
}

export default AV
