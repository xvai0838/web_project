/**
 * 本地存储 API
 * 
 * 使用 localStorage 实现用户认证和数据存储
 * 接口与 userApi.js 保持一致，方便切换
 */

const STORAGE_KEY = 'photo_analysis_users'
const CURRENT_USER_KEY = 'local_current_user'
const TOKEN_KEY = 'local_auth_token'
const USER_CACHE_KEY = 'local_user_cache'

// ==================== 内部工具函数 ====================

function getAllUsers() {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : {}
}

function saveAllUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
}

function generateToken() {
  return 'local_' + generateId()
}

// ==================== 认证 API ====================

/**
 * 获取存储的 token
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 设置 token
 */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * 清除 token
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_CACHE_KEY)
  localStorage.removeItem(CURRENT_USER_KEY)
}

/**
 * 获取缓存的用户数据
 */
export function getCachedUser() {
  const data = localStorage.getItem(USER_CACHE_KEY)
  return data ? JSON.parse(data) : null
}

/**
 * 缓存用户数据
 */
function setCachedUser(user) {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
}

/**
 * 检查是否已登录
 */
export function isLoggedIn() {
  return !!getToken() && !!localStorage.getItem(CURRENT_USER_KEY)
}

/**
 * 用户注册
 */
export async function register(username, password) {
  const users = getAllUsers()
  
  if (users[username]) {
    throw new Error('用户名已存在')
  }
  
  if (username.length < 3 || username.length > 20) {
    throw new Error('用户名长度需要3-20个字符')
  }
  
  if (password.length < 6) {
    throw new Error('密码长度至少6个字符')
  }
  
  const user = {
    id: generateId(),
    username,
    password, // 本地存储不加密，仅用于演示
    nickname: '',
    avatar: '',
    email: '',
    history: [],
    createdAt: Date.now()
  }
  
  users[username] = user
  saveAllUsers(users)
  
  // 自动登录
  const token = generateToken()
  setToken(token)
  localStorage.setItem(CURRENT_USER_KEY, username)
  
  const userInfo = { ...user }
  delete userInfo.password
  delete userInfo.history
  setCachedUser(userInfo)
  
  return { success: true, token, user: userInfo }
}

/**
 * 用户登录
 */
export async function login(username, password) {
  const users = getAllUsers()
  
  if (!users[username]) {
    throw new Error('用户名或密码错误')
  }
  
  if (users[username].password !== password) {
    throw new Error('用户名或密码错误')
  }
  
  const token = generateToken()
  setToken(token)
  localStorage.setItem(CURRENT_USER_KEY, username)
  
  const user = users[username]
  const userInfo = {
    id: user.id,
    username: user.username,
    nickname: user.nickname || '',
    avatar: user.avatar || '',
    email: user.email || ''
  }
  setCachedUser(userInfo)
  
  return { success: true, token, user: userInfo }
}

/**
 * 用户登出
 */
export async function logout() {
  clearToken()
  return { success: true }
}

/**
 * 验证登录状态
 */
export async function verifyAuth() {
  if (!isLoggedIn()) {
    return { success: false }
  }
  
  const username = localStorage.getItem(CURRENT_USER_KEY)
  const users = getAllUsers()
  
  if (!users[username]) {
    clearToken()
    return { success: false }
  }
  
  const user = users[username]
  const userInfo = {
    id: user.id,
    username: user.username,
    nickname: user.nickname || '',
    avatar: user.avatar || '',
    email: user.email || ''
  }
  setCachedUser(userInfo)
  
  return { success: true, user: userInfo }
}

// ==================== 用户信息 API ====================

/**
 * 获取用户信息
 */
export async function getUserInfo() {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    throw new Error('未登录')
  }
  
  const users = getAllUsers()
  const user = users[username]
  
  if (!user) {
    throw new Error('用户不存在')
  }
  
  const userInfo = {
    id: user.id,
    username: user.username,
    nickname: user.nickname || '',
    avatar: user.avatar || '',
    email: user.email || ''
  }
  
  return { success: true, user: userInfo }
}

/**
 * 更新用户信息
 */
export async function updateUserInfo(info) {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    throw new Error('未登录')
  }
  
  const users = getAllUsers()
  if (!users[username]) {
    throw new Error('用户不存在')
  }
  
  users[username] = {
    ...users[username],
    nickname: info.nickname || '',
    avatar: info.avatar || '',
    email: info.email || ''
  }
  saveAllUsers(users)
  
  const userInfo = {
    id: users[username].id,
    username: users[username].username,
    nickname: users[username].nickname,
    avatar: users[username].avatar,
    email: users[username].email
  }
  setCachedUser(userInfo)
  
  return { success: true, user: userInfo }
}

// ==================== 历史记录 API ====================

/**
 * 获取历史记录
 */
export async function getHistoryRecords() {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    return []
  }
  
  const users = getAllUsers()
  const user = users[username]
  
  if (!user || !user.history) {
    return []
  }
  
  return user.history.map(record => ({
    id: record.id,
    imageData: record.imageData,
    analysisImage: record.analysisImage,
    result: record.result,
    timestamp: record.timestamp
  }))
}

/**
 * 添加历史记录
 */
export async function addHistoryRecord(imageData, analysisImage, result) {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    throw new Error('未登录')
  }
  
  const users = getAllUsers()
  if (!users[username]) {
    throw new Error('用户不存在')
  }
  
  if (!users[username].history) {
    users[username].history = []
  }
  
  // 检查数量限制
  if (users[username].history.length >= 50) {
    throw new Error('历史记录已达上限(50条)，请先删除旧记录')
  }
  
  const record = {
    id: generateId(),
    imageData,
    analysisImage,
    result,
    timestamp: Date.now()
  }
  
  users[username].history.unshift(record)
  saveAllUsers(users)
  
  return { success: true, record }
}

/**
 * 删除历史记录
 */
export async function deleteHistoryRecord(id) {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    throw new Error('未登录')
  }
  
  const users = getAllUsers()
  if (!users[username] || !users[username].history) {
    throw new Error('记录不存在')
  }
  
  users[username].history = users[username].history.filter(r => r.id !== id)
  saveAllUsers(users)
  
  return { success: true }
}

/**
 * 清理过期记录（24小时）
 */
export async function cleanupHistory() {
  const username = localStorage.getItem(CURRENT_USER_KEY)
  if (!username) {
    return { success: true, deleted: 0 }
  }
  
  const users = getAllUsers()
  if (!users[username] || !users[username].history) {
    return { success: true, deleted: 0 }
  }
  
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000
  const originalLength = users[username].history.length
  
  users[username].history = users[username].history.filter(record => {
    return (now - record.timestamp) < twentyFourHours
  })
  
  const deleted = originalLength - users[username].history.length
  if (deleted > 0) {
    saveAllUsers(users)
  }
  
  return { success: true, deleted }
}
