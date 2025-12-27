/**
 * 用户 API 服务
 * 连接后端服务器进行用户认证和数据同步
 */

// 后端 API 地址 - 使用相对路径，通过 Nginx 反向代理访问
const API_BASE_URL = '/api'

// Token 存储键
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'current_user_data'

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
  localStorage.removeItem(USER_KEY)
}

/**
 * 获取缓存的用户数据
 */
export function getCachedUser() {
  const data = localStorage.getItem(USER_KEY)
  return data ? JSON.parse(data) : null
}

/**
 * 缓存用户数据
 */
export function setCachedUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * 发送 API 请求
 */
async function request(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (!response.ok) {
      // 如果是会话失效，清除本地数据
      if (data.code === 'SESSION_INVALID') {
        clearToken()
        // 触发登出事件
        window.dispatchEvent(new CustomEvent('session-invalid'))
      }
      throw new Error(data.error || '请求失败')
    }

    return data
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络')
    }
    throw error
  }
}

// ==================== 认证 API ====================

/**
 * 用户注册
 */
export async function register(username, password) {
  const data = await request('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  
  if (data.success) {
    setToken(data.token)
    setCachedUser(data.user)
  }
  
  return data
}

/**
 * 用户登录
 */
export async function login(username, password) {
  const data = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  
  if (data.success) {
    setToken(data.token)
    setCachedUser(data.user)
  }
  
  return data
}

/**
 * 用户登出
 */
export async function logout() {
  try {
    await request('/logout', { method: 'POST' })
  } catch (e) {
    // 忽略登出错误
  }
  clearToken()
}

/**
 * 验证登录状态
 */
export async function verifyAuth() {
  if (!getToken()) {
    return { success: false }
  }
  
  try {
    const data = await request('/verify')
    if (data.success) {
      setCachedUser(data.user)
    }
    return data
  } catch (error) {
    clearToken()
    return { success: false, error: error.message }
  }
}

/**
 * 检查是否已登录
 */
export function isLoggedIn() {
  return !!getToken()
}

// ==================== 用户信息 API ====================

/**
 * 获取用户信息
 */
export async function getUserInfo() {
  const data = await request('/user')
  if (data.success) {
    setCachedUser(data.user)
  }
  return data
}

/**
 * 更新用户信息
 */
export async function updateUserInfo(userInfo) {
  const data = await request('/user', {
    method: 'PUT',
    body: JSON.stringify(userInfo)
  })
  if (data.success) {
    setCachedUser(data.user)
  }
  return data
}

// ==================== 历史记录 API ====================

/**
 * 获取历史记录
 */
export async function getHistoryRecords() {
  const data = await request('/history')
  return data.success ? data.records : []
}

/**
 * 添加历史记录
 */
export async function addHistoryRecord(imageData, analysisImage, result) {
  const data = await request('/history', {
    method: 'POST',
    body: JSON.stringify({ imageData, analysisImage, result })
  })
  return data
}

/**
 * 删除历史记录
 */
export async function deleteHistoryRecord(id) {
  const data = await request(`/history/${id}`, {
    method: 'DELETE'
  })
  return data
}

/**
 * 清理过期记录
 */
export async function cleanupHistory() {
  const data = await request('/history/cleanup', {
    method: 'POST'
  })
  return data
}

/**
 * 设置 API 基础地址
 */
export function setApiBaseUrl(url) {
  // 这个函数用于动态设置 API 地址
  // 实际使用时需要修改 API_BASE_URL 常量
  console.log('API Base URL:', url)
}
