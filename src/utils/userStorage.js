/**
 * 用户数据存储工具
 * 
 * 数据存储位置：localStorage (浏览器本地)
 * 
 * 如需跨设备同步，需要配置后端服务器。
 * 以下提供了一个简单的 JSON Server 方案。
 */

const STORAGE_KEY = 'photo_analysis_users'
const CURRENT_USER_KEY = 'currentUser'
const SETUP_COMPLETE_KEY = 'userSetupComplete'

// 后端 API 地址（如果配置了后端服务）
let API_BASE_URL = ''

/**
 * 设置后端 API 地址
 * @param {string} url - API 基础地址
 */
export function setApiBaseUrl(url) {
  API_BASE_URL = url
}

/**
 * 获取所有用户数据
 */
export function getAllUsers() {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : {}
}

/**
 * 保存所有用户数据
 */
export function saveAllUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
}

/**
 * 获取当前登录用户名
 */
export function getCurrentUsername() {
  return localStorage.getItem(CURRENT_USER_KEY)
}

/**
 * 设置当前登录用户
 */
export function setCurrentUser(username) {
  localStorage.setItem(CURRENT_USER_KEY, username)
}

/**
 * 清除当前用户登录状态
 */
export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY)
  localStorage.removeItem(SETUP_COMPLETE_KEY)
}

/**
 * 获取用户信息
 */
export function getUserInfo(username) {
  const users = getAllUsers()
  return users[username] || null
}

/**
 * 更新用户信息
 */
export function updateUserInfo(username, info) {
  const users = getAllUsers()
  if (users[username]) {
    users[username] = { ...users[username], ...info }
    saveAllUsers(users)
    return true
  }
  return false
}

/**
 * 用户注册
 */
export function registerUser(username, password) {
  const users = getAllUsers()
  if (users[username]) {
    return { success: false, message: '用户名已存在' }
  }
  users[username] = {
    password,
    nickname: '',
    avatar: '',
    email: '',
    history: [],
    createdAt: Date.now()
  }
  saveAllUsers(users)
  return { success: true }
}

/**
 * 用户登录验证
 */
export function loginUser(username, password) {
  const users = getAllUsers()
  if (!users[username]) {
    return { success: false, message: '用户不存在' }
  }
  if (users[username].password !== password) {
    return { success: false, message: '密码错误' }
  }
  setCurrentUser(username)
  return { success: true, user: users[username] }
}

/**
 * 添加历史记录到用户
 */
export function addUserHistory(username, historyItem) {
  const users = getAllUsers()
  if (users[username]) {
    if (!users[username].history) {
      users[username].history = []
    }
    users[username].history.unshift({
      ...historyItem,
      id: Date.now(),
      date: new Date().toLocaleString('zh-CN')
    })
    // 限制历史记录数量
    if (users[username].history.length > 50) {
      users[username].history = users[username].history.slice(0, 50)
    }
    saveAllUsers(users)
    return true
  }
  return false
}

/**
 * 导出用户数据为 JSON 文件（用于备份）
 */
export function exportUserData() {
  const users = getAllUsers()
  const dataStr = JSON.stringify(users, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `user_data_backup_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 从 JSON 文件导入用户数据
 */
export function importUserData(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    saveAllUsers(data)
    return { success: true }
  } catch (e) {
    return { success: false, message: '数据格式错误' }
  }
}
