/**
 * 统一存储服务
 * 
 * 通过修改 USE_BACKEND 变量来切换存储模式：
 * - true: 使用后端服务器存储（需要运行 server/index.js）
 * - false: 使用浏览器本地存储（localStorage）
 */

// ========== 在这里切换存储模式 ==========
const USE_BACKEND = false
// ========================================

// 根据配置导出对应的存储服务
import * as backendApi from './userApi.js'
import * as localApi from './localStorageApi.js'

const api = USE_BACKEND ? backendApi : localApi

// 导出所有方法
export const {
  // 认证相关
  login,
  register,
  logout,
  verifyAuth,
  isLoggedIn,
  getToken,
  clearToken,
  getCachedUser,
  
  // 用户信息
  getUserInfo,
  updateUserInfo,
  
  // 历史记录
  getHistoryRecords,
  addHistoryRecord,
  deleteHistoryRecord,
  cleanupHistory
} = api

// 导出当前存储模式
export const STORAGE_MODE = USE_BACKEND ? 'backend' : 'local'

// 检查后端是否可用
export async function checkBackendAvailable() {
  if (!USE_BACKEND) return false
  try {
    const response = await fetch('/api/verify', { method: 'GET' })
    return response.status !== 502 && response.status !== 503
  } catch {
    return false
  }
}
