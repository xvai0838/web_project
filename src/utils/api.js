/**
 * API 工具模块
 * 用于调用 doubao-seed-1-6-vision 视觉模型进行图片分析
 */

// API 配置
const API_CONFIG = {
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
  // API Key 需要用户配置
  apiKey: '#'
}

/**
 * 设置 API Key
 * @param {string} key - API 密钥
 */
export function setApiKey(key) {
  API_CONFIG.apiKey = key
}

/**
 * 获取当前 API Key
 * @returns {string} API 密钥
 */
export function getApiKey() {
  return API_CONFIG.apiKey
}

/**
 * 构建 API 请求体
 * @param {string} base64Image - Base64 编码的图片数据
 * @returns {object} 请求体对象
 */
export function buildRequestBody(base64Image) {
  // 确保 base64 图片有正确的前缀
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`

  return {
    model: API_CONFIG.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          },
          {
            type: 'text',
            text: `请分析这张摄影图片，并以JSON格式返回结果，包含以下字段：
{
  "composition": {
    "type": "构图类型（如三分法、对角线、中心构图等）",
    "lines": [
      {"startX": 起点X百分比0-100, "startY": 起点Y百分比0-100, "endX": 终点X百分比0-100, "endY": 终点Y百分比0-100, "color": "线条颜色"}
    ],
    "description": "构图分析描述"
  },
  "lighting": "光线分析",
  "color": "色彩分析",
  "subject": "主体表达分析",
  "perspective": "景别与角度分析",
  "improvement": "不足与提升建议（指出照片的不足之处，并给出具体的改进建议）"
}`
          }
        ]
      }
    ]
  }
}

/**
 * 解析 API 响应中的 JSON 结果
 * @param {string} content - API 返回的文本内容
 * @returns {object} 解析后的分析结果
 */
export function parseAnalysisResult(content) {
  // 尝试从响应中提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('无法从响应中解析JSON结果')
  }
  
  const result = JSON.parse(jsonMatch[0])
  
  // 验证必要字段
  const requiredFields = ['composition', 'lighting', 'color', 'subject', 'perspective', 'improvement']
  for (const field of requiredFields) {
    if (!(field in result)) {
      throw new Error(`分析结果缺少必要字段: ${field}`)
    }
  }
  
  return result
}

/**
 * 调用 doubao-seed-1-6-vision 模型分析图片
 * @param {string} base64Image - Base64 编码的图片数据
 * @returns {Promise<object>} 分析结果
 */
export async function analyzeImage(base64Image) {
  if (!API_CONFIG.apiKey) {
    throw new Error('API密钥未配置，请先设置API Key')
  }

  const requestBody = buildRequestBody(base64Image)

  const response = await fetch(API_CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API密钥无效或已过期')
    } else if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后重试')
    } else if (response.status >= 500) {
      throw new Error('服务器错误，请稍后重试')
    }
    throw new Error(`API请求失败: ${response.status}`)
  }

  const data = await response.json()
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('API响应格式错误')
  }

  const content = data.choices[0].message.content
  return parseAnalysisResult(content)
}

/**
 * 在 Canvas 上绘制构图辅助线
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @param {HTMLImageElement} image - 原始图片
 * @param {Array} lines - 构图线数组
 */
export function drawCompositionLines(canvas, image, lines) {
  if (!canvas || !image || !lines) {
    return
  }

  const ctx = canvas.getContext('2d')
  
  // 设置 Canvas 尺寸与图片一致
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  
  // 绘制原图
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  
  // 绘制构图线
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  
  for (const line of lines) {
    const startX = (line.startX / 100) * canvas.width
    const startY = (line.startY / 100) * canvas.height
    const endX = (line.endX / 100) * canvas.width
    const endY = (line.endY / 100) * canvas.height
    
    ctx.strokeStyle = line.color || '#ff0000'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
  }
}

// ==================== 历史记录功能 ====================

const HISTORY_STORAGE_KEY_PREFIX = 'photo_analysis_history_'
const MAX_HISTORY_RECORDS = 5  // 最大历史记录数量
const THUMBNAIL_MAX_WIDTH = 400  // 缩略图最大宽度

/**
 * 获取当前用户的历史记录存储键
 * @returns {string} 存储键
 */
function getHistoryStorageKey() {
  const currentUser = localStorage.getItem('currentUser')
  if (currentUser) {
    return HISTORY_STORAGE_KEY_PREFIX + currentUser
  }
  return HISTORY_STORAGE_KEY_PREFIX + 'guest'
}

/**
 * 生成唯一ID
 * @returns {string} 唯一标识符
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
}

/**
 * 压缩图片为缩略图
 * @param {string} base64Image - 原始 base64 图片
 * @param {number} maxWidth - 最大宽度
 * @returns {Promise<string>} 压缩后的 base64 图片
 */
export function compressImage(base64Image, maxWidth = THUMBNAIL_MAX_WIDTH) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // 按比例缩小
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // 使用 JPEG 格式，质量 0.6
      const compressed = canvas.toDataURL('image/jpeg', 0.6)
      resolve(compressed)
    }
    img.onerror = () => {
      // 压缩失败时返回原图
      resolve(base64Image)
    }
    img.src = base64Image
  })
}

/**
 * 从 localStorage 获取当前用户的历史记录
 * @returns {Array} 历史记录数组
 */
export function getHistoryRecords() {
  try {
    const key = getHistoryStorageKey()
    const data = localStorage.getItem(key)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('读取历史记录失败:', error)
    return []
  }
}

/**
 * 获取历史记录数量
 * @returns {number} 记录数量
 */
export function getHistoryCount() {
  return getHistoryRecords().length
}

/**
 * 检查是否可以添加新记录
 * @returns {boolean} 是否可以添加
 */
export function canAddHistoryRecord() {
  return getHistoryCount() < MAX_HISTORY_RECORDS
}

/**
 * 获取最大记录数
 * @returns {number} 最大记录数
 */
export function getMaxHistoryRecords() {
  return MAX_HISTORY_RECORDS
}

/**
 * 保存历史记录到 localStorage（当前用户）
 * @param {Array} records - 历史记录数组
 * @returns {boolean} 是否保存成功
 */
export function saveHistoryRecords(records) {
  try {
    const key = getHistoryStorageKey()
    localStorage.setItem(key, JSON.stringify(records))
    return true
  } catch (error) {
    console.error('保存历史记录失败:', error)
    if (error.name === 'QuotaExceededError') {
      // 存储空间不足，尝试清理后重试
      try {
        const key = getHistoryStorageKey()
        localStorage.removeItem(key)
        // 只保留最新的记录
        const trimmed = records.slice(-Math.min(records.length, 3))
        localStorage.setItem(key, JSON.stringify(trimmed))
        return true
      } catch (e) {
        const key = getHistoryStorageKey()
        localStorage.removeItem(key)
        return false
      }
    }
    return false
  }
}

/**
 * 添加新的历史记录（带图片压缩）
 * @param {string} imageData - 原图 base64
 * @param {string} analysisImage - 分析图 base64
 * @param {object} result - 分析结果
 * @returns {Promise<object>} 新创建的历史记录
 * @throws {Error} 超出限制或保存失败时抛出错误
 */
export async function addHistoryRecord(imageData, analysisImage, result) {
  const records = getHistoryRecords()

  // 检查是否超出限制
  if (records.length >= MAX_HISTORY_RECORDS) {
    throw new Error(`LIMIT_EXCEEDED:历史记录已达上限(${MAX_HISTORY_RECORDS}条)，请先删除旧记录`)
  }

  // 压缩图片以节省空间
  const compressedImage = await compressImage(imageData)
  const compressedAnalysis = await compressImage(analysisImage)

  const record = {
    id: generateId(),
    timestamp: Date.now(),
    imageData: compressedImage,
    analysisImage: compressedAnalysis,
    result
  }

  records.push(record)

  const success = saveHistoryRecords(records)
  if (!success) {
    throw new Error('存储空间不足，无法保存')
  }

  return record
}

/**
 * 根据ID获取历史记录
 * @param {string} id - 记录ID
 * @returns {object|null} 历史记录或null
 */
export function getHistoryRecordById(id) {
  const records = getHistoryRecords()
  return records.find(r => r.id === id) || null
}

/**
 * 删除历史记录
 * @param {string} id - 记录ID
 */
export function deleteHistoryRecord(id) {
  const records = getHistoryRecords()
  const filtered = records.filter(r => r.id !== id)
  saveHistoryRecords(filtered)
}

/**
 * 清理超过24小时的历史记录 (Requirements 4.4)
 * @returns {number} 清理的记录数量
 */
export function cleanExpiredRecords() {
  const records = getHistoryRecords()
  const now = Date.now()
  const twentyFourHours = 24 * 60 * 60 * 1000 // 24小时的毫秒数
  
  const validRecords = records.filter(record => {
    const age = now - record.timestamp
    return age < twentyFourHours
  })
  
  const cleanedCount = records.length - validRecords.length
  
  if (cleanedCount > 0) {
    saveHistoryRecords(validRecords)
  }
  
  return cleanedCount
}

/**
 * 将错误转换为用户友好的提示信息
 * @param {Error} error - 错误对象
 * @returns {string} 用户友好的错误信息
 */
export function getErrorMessage(error) {
  const message = error.message || String(error)
  
  // 网络错误
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('network')) {
    return '网络连接失败，请检查网络后重试'
  }
  
  // API 密钥错误
  if (message.includes('API密钥') || message.includes('401') || message.includes('Unauthorized')) {
    return 'API配置错误，请检查密钥设置'
  }
  
  // 超时错误
  if (message.includes('timeout') || message.includes('超时')) {
    return '分析超时，请稍后重试'
  }
  
  // 解析错误
  if (message.includes('JSON') || message.includes('解析')) {
    return '分析结果解析失败，请重试'
  }
  
  // 频率限制
  if (message.includes('429') || message.includes('频繁')) {
    return '请求过于频繁，请稍后重试'
  }
  
  // 服务器错误
  if (message.includes('500') || message.includes('服务器')) {
    return '服务器错误，请稍后重试'
  }
  
  // 其他已知错误直接返回
  if (message.includes('请') || message.includes('错误')) {
    return message
  }
  
  // 未知错误
  return '分析失败，请重试'
}
