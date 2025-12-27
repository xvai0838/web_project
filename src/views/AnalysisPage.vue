<template>
  <div class="analysis-page">
    <!-- 返回按钮 -->
    <button class="back-btn" @click="goBack">
      ← 返回
    </button>

    <!-- 历史记录入口 (Requirements 4.1) -->
    <button class="history-btn" @click="showHistory = !showHistory">
      📋 历史记录
    </button>

    <!-- 个人按钮 -->
    <div class="profile-btn" @click="goToProfile">
      <img v-if="userAvatar" :src="userAvatar" alt="头像" class="avatar-img" />
      <span v-else class="avatar-placeholder">👤</span>
    </div>

    <!-- 历史记录面板 (Requirements 4.2) -->
    <div v-if="showHistory" class="history-panel">
      <div class="history-header">
        <h3>历史记录 ({{ historyRecords.length }}/{{ getMaxHistoryRecords() }})</h3>
        <button class="close-btn" @click="showHistory = false">×</button>
      </div>
      <div class="history-list">
        <p v-if="historyRecords.length === 0" class="empty-tip">暂无历史记录</p>
        <div
          v-for="record in historyRecords"
          :key="record.id"
          class="history-item"
        >
          <img :src="record.imageData" alt="历史图片" class="history-thumb" @click.stop="openImageViewer(record.imageData)" />
          <div class="history-info" @click="restoreFromHistory(record)">
            <p class="history-type">{{ record.result?.composition?.type || '未知构图' }}</p>
            <p class="history-time">{{ formatTime(record.timestamp) }}</p>
          </div>
          <button class="delete-history-btn" @click.stop="deleteRecord(record.id)" title="删除">🗑️</button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 全局文件输入框 -->
      <input 
        type="file" 
        ref="fileInput" 
        accept="image/jpeg,image/png,image/webp"
        @change="onFileSelect"
        style="display: none"
      />

      <!-- 上传区 -->
      <div 
        class="upload-area" 
        v-if="!imageData && !isLoading"
        @click="triggerUpload"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        :class="{ 'drag-over': isDragging }"
      >
        <!-- 欢迎语 -->
        <p class="welcome-text" v-if="userName">欢迎，{{ userName }}</p>
        <div class="upload-icon">📷</div>
        <p class="upload-text">点击或拖拽上传图片</p>
        <p class="upload-hint">支持 JPG、PNG、WebP 格式</p>
      </div>

      <!-- 加载状态 (Requirements 6.3) -->
      <div class="loading-area" v-if="isLoading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">正在分析图片，请稍候...</p>
          <p class="loading-hint">AI 正在识别构图、光线、色彩等信息</p>
        </div>
      </div>

      <!-- 结果展示区 -->
      <div class="result-area" v-if="imageData && !isLoading">
        <!-- 图片对比区 (Requirements 3.2, 3.3) -->
        <div class="image-comparison">
          <div class="image-box">
            <h4>原图</h4>
            <img 
              :src="imageData" 
              alt="原图" 
              ref="originalImage" 
              @load="onOriginalImageLoad" 
              @click="openImageViewer(imageData)"
              class="clickable-image"
            />
          </div>
          <div class="image-box">
            <h4>分析图</h4>
            <div class="canvas-container" @click="openImageViewer(analysisImageData || imageData)">
              <canvas ref="analysisCanvas" class="clickable-image"></canvas>
            </div>
          </div>
        </div>

        <!-- 文字分析结果 (Requirements 3.4) -->
        <div class="analysis-text" v-if="analysisResult">
          <div class="analysis-item" data-dimension="composition">
            <h4>📐 构图分析</h4>
            <p v-if="analysisResult.composition?.type"><strong>类型：</strong>{{ analysisResult.composition.type }}</p>
            <p>{{ analysisResult.composition?.description || '暂无构图分析' }}</p>
          </div>
          <div class="analysis-item" data-dimension="lighting">
            <h4>💡 光线分析</h4>
            <p>{{ analysisResult.lighting || '暂无光线分析' }}</p>
          </div>
          <div class="analysis-item" data-dimension="color">
            <h4>🎨 色彩分析</h4>
            <p>{{ analysisResult.color || '暂无色彩分析' }}</p>
          </div>
          <div class="analysis-item" data-dimension="subject">
            <h4>🎯 主体表达</h4>
            <p>{{ analysisResult.subject || '暂无主体表达分析' }}</p>
          </div>
          <div class="analysis-item" data-dimension="perspective">
            <h4>📷 景别与角度</h4>
            <p>{{ analysisResult.perspective || '暂无景别与角度分析' }}</p>
          </div>
          <div class="analysis-item" data-dimension="improvement">
            <h4>💡 不足与提升</h4>
            <p>{{ analysisResult.improvement || '暂无改进建议' }}</p>
          </div>
        </div>

        <!-- 操作按钮区 -->
        <div class="action-buttons">
          <button class="save-btn" @click="saveToHistory" :disabled="isSaved || !analysisResult || isSaving">
            {{ isSaving ? '保存中...' : (isSaved ? '✓ 已保存' : '💾 保存到历史') }}
          </button>
          <button class="continue-btn" @click="continueUpload">📷 继续上传</button>
          <button class="reset-btn" @click="resetAnalysis">重新开始</button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div class="error-area" v-if="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
        <button class="retry-btn" @click="resetAnalysis">重试</button>
      </div>
    </div>

    <!-- 图片放大查看弹窗 -->
    <div v-if="showImageViewer" class="image-viewer-modal" @click.self="closeImageViewer">
      <div class="image-viewer-content">
        <button class="viewer-close-btn" @click="closeImageViewer">×</button>
        <div class="viewer-controls">
          <button @click="zoomOut" :disabled="zoomLevel <= 0.5">−</button>
          <span>{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click="zoomIn" :disabled="zoomLevel >= 3">+</button>
          <button @click="resetZoom">重置</button>
        </div>
        <div class="viewer-image-container" ref="viewerContainer">
          <img 
            :src="viewerImageSrc" 
            :style="{ transform: `scale(${zoomLevel})` }"
            @wheel.prevent="handleWheel"
            draggable="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  analyzeImage,
  drawCompositionLines,
  getErrorMessage,
  getApiKey,
  setApiKey,
  compressImage
} from '../utils/api.js'
import {
  verifyAuth,
  getCachedUser,
  isLoggedIn,
  getHistoryRecords as getHistoryFromServer,
  addHistoryRecord as addHistoryToServer,
  deleteHistoryRecord as deleteHistoryFromServer
} from '../utils/storage.js'

const router = useRouter()
const route = useRoute()

const MAX_HISTORY_RECORDS = 50

// 用户信息
const userAvatar = ref('')
const userName = ref('')

// 状态
const fileInput = ref(null)
const originalImage = ref(null)
const analysisCanvas = ref(null)
const imageData = ref(null)
const analysisImageData = ref(null)
const analysisResult = ref(null)
const isLoading = ref(false)
const isDragging = ref(false)
const errorMessage = ref(null)
const showHistory = ref(false)
const originalImageLoaded = ref(false)
const historyRecords = ref([])
const isSaved = ref(false)
const currentRecordId = ref(null)
const isSaving = ref(false)  // 保存中状态

// 图片查看器状态
const showImageViewer = ref(false)
const viewerImageSrc = ref('')
const zoomLevel = ref(1)
const viewerContainer = ref(null)

// 打开图片查看器
function openImageViewer(imageSrc) {
  viewerImageSrc.value = imageSrc
  zoomLevel.value = 1
  showImageViewer.value = true
}

// 关闭图片查看器
function closeImageViewer() {
  showImageViewer.value = false
  viewerImageSrc.value = ''
}

// 放大
function zoomIn() {
  if (zoomLevel.value < 3) {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.25)
  }
}

// 缩小
function zoomOut() {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.25)
  }
}

// 重置缩放
function resetZoom() {
  zoomLevel.value = 1
}

// 鼠标滚轮缩放
function handleWheel(e) {
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

// 跳转到个人页面
function goToProfile() {
  if (!isLoggedIn()) {
    router.push('/login')
  } else {
    router.push('/user-profile')
  }
}

// 返回欢迎页面
function goBack() {
  router.push('/')
}

// 获取最大历史记录数
function getMaxHistoryRecords() {
  return MAX_HISTORY_RECORDS
}

// 检查是否可以添加历史记录
function canAddHistoryRecord() {
  return historyRecords.value.length < MAX_HISTORY_RECORDS
}

// 监听会话失效事件
function handleSessionInvalid() {
  alert('您的账号已在其他设备登录，请重新登录')
  router.push('/login')
}

// 页面加载时加载历史
onMounted(async () => {
  // 监听会话失效事件
  window.addEventListener('session-invalid', handleSessionInvalid)
  
  // 验证登录状态
  if (!isLoggedIn()) {
    router.push('/login')
    return
  }
  
  try {
    const result = await verifyAuth()
    if (!result.success) {
      router.push('/login')
      return
    }
    
    // 加载用户信息
    const user = getCachedUser()
    if (user) {
      userAvatar.value = user.avatar || ''
      userName.value = user.nickname || user.username
    }
    
    // 加载历史记录
    await loadHistoryRecords()
    
    // 检查URL参数，是否需要打开历史记录面板
    if (route.query.showHistory === 'true') {
      showHistory.value = true
    }
  } catch (error) {
    console.error('初始化失败:', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('session-invalid', handleSessionInvalid)
})

// 加载历史记录
async function loadHistoryRecords() {
  try {
    const records = await getHistoryFromServer()
    historyRecords.value = records.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('加载历史记录失败:', error)
  }
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes}`
}

// 从历史记录恢复 (Requirements 4.3)
function restoreFromHistory(record) {
  imageData.value = record.imageData
  analysisImageData.value = record.analysisImage
  analysisResult.value = record.result
  showHistory.value = false
  errorMessage.value = null
  isSaved.value = true  // 从历史恢复的记录已保存
  currentRecordId.value = record.id
  
  // 等待 DOM 更新后绘制分析图
  nextTick(() => {
    if (analysisCanvas.value && record.analysisImage) {
      const img = new Image()
      img.onload = () => {
        const ctx = analysisCanvas.value.getContext('2d')
        analysisCanvas.value.width = img.width
        analysisCanvas.value.height = img.height
        ctx.drawImage(img, 0, 0)
      }
      img.src = record.analysisImage
    }
  })
}

// 触发文件选择
function triggerUpload() {
  fileInput.value?.click()
}

// 拖拽事件处理
function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

// 文件选择处理
function onFileSelect(e) {
  const files = e.target?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

// 处理文件 - 转换为 base64
function handleFile(file) {
  // 验证文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    errorMessage.value = '请上传JPG、PNG或WebP格式的图片'
    return
  }

  // 验证文件大小 (限制 10MB)
  if (file.size > 10 * 1024 * 1024) {
    errorMessage.value = '图片大小超过限制，请压缩后重试'
    return
  }

  console.log('处理新文件，重置所有状态')
  // 重置状态，准备新的分析
  errorMessage.value = null
  isSaved.value = false  // 关键：重置保存状态
  currentRecordId.value = null
  analysisImageData.value = null
  analysisResult.value = null
  
  const reader = new FileReader()
  reader.onload = (e) => {
    imageData.value = e.target.result
    console.log('文件读取完成，isSaved:', isSaved.value)
    startAnalysis()
  }
  reader.onerror = () => {
    errorMessage.value = '图片读取失败，请重新选择'
  }
  reader.readAsDataURL(file)
}

// 开始分析
async function startAnalysis() {
  // 检查 API Key
  if (!getApiKey()) {
    const key = prompt('请输入 doubao API Key:')
    if (key) {
      setApiKey(key)
    } else {
      errorMessage.value = 'API密钥未配置，请先设置API Key'
      imageData.value = null
      return
    }
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const result = await analyzeImage(imageData.value)
    analysisResult.value = result
    
    // 确保重置保存状态 - 新分析结果应该可以保存
    isSaved.value = false
    currentRecordId.value = null
    analysisImageData.value = null
    
    console.log('分析完成，isSaved:', isSaved.value, 'analysisResult:', !!analysisResult.value)
    
    // 等待 DOM 更新后绘制构图线
    await nextTick()
    
    // 等待一小段时间确保 canvas 已渲染
    await new Promise(resolve => setTimeout(resolve, 100))
    
    await drawAnalysisImage()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
    analysisResult.value = null
  } finally {
    isLoading.value = false
  }
}

// 绘制分析图
function drawAnalysisImage() {
  return new Promise((resolve) => {
    if (!analysisCanvas.value || !analysisResult.value || !imageData.value) {
      resolve()
      return
    }

    const img = new Image()
    img.onload = () => {
      const lines = analysisResult.value.composition?.lines || []
      drawCompositionLines(analysisCanvas.value, img, lines)
      
      // 保存分析图数据
      try {
        analysisImageData.value = analysisCanvas.value.toDataURL('image/png')
        console.log('分析图数据已生成')
      } catch (e) {
        console.error('无法获取分析图数据:', e)
      }
      resolve()
    }
    img.onerror = () => {
      console.error('图片加载失败')
      resolve()
    }
    img.src = imageData.value
  })
}

// 原图加载完成回调
function onOriginalImageLoad() {
  originalImageLoaded.value = true
  // 如果分析结果已存在，绘制分析图
  if (analysisResult.value) {
    drawAnalysisImage()
  }
}

// 删除历史记录
async function deleteRecord(id) {
  if (confirm('确定要删除这条历史记录吗？')) {
    try {
      await deleteHistoryFromServer(id)
      await loadHistoryRecords()
      // 如果删除的是当前显示的记录，重置状态
      if (currentRecordId.value === id) {
        currentRecordId.value = null
        isSaved.value = false
      }
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }
}

// 手动保存到历史记录
async function saveToHistory() {
  console.log('saveToHistory 被调用')

  // 检查必要条件
  if (!analysisResult.value || !imageData.value) {
    console.log('保存条件不满足: 缺少分析结果或图片')
    return
  }

  // 如果已保存或正在保存，跳过
  if (isSaved.value || isSaving.value) {
    return
  }

  // 检查是否达到上限
  if (!canAddHistoryRecord()) {
    const maxCount = getMaxHistoryRecords()
    alert(`历史记录已达上限(${maxCount}条)，请先在历史记录面板中删除旧记录后再保存。`)
    showHistory.value = true  // 打开历史面板方便删除
    return
  }

  // 如果没有分析图数据，尝试从 canvas 获取
  let analysisImg = analysisImageData.value
  if (!analysisImg && analysisCanvas.value) {
    try {
      analysisImg = analysisCanvas.value.toDataURL('image/png')
    } catch (e) {
      console.error('获取分析图失败:', e)
      analysisImg = imageData.value
    }
  }

  if (!analysisImg) {
    analysisImg = imageData.value
  }

  isSaving.value = true
  errorMessage.value = null

  try {
    // 压缩图片
    const compressedImage = await compressImage(imageData.value)
    const compressedAnalysis = await compressImage(analysisImg)
    
    const result = await addHistoryToServer(compressedImage, compressedAnalysis, analysisResult.value)
    currentRecordId.value = result.record.id
    isSaved.value = true
    analysisImageData.value = analysisImg
    await loadHistoryRecords()
    console.log('保存成功:', result.record.id)
  } catch (e) {
    console.error('保存失败:', e)
    if (e.message.includes('上限')) {
      alert(`历史记录已达上限(${getMaxHistoryRecords()}条)，请先删除旧记录。`)
      showHistory.value = true
    } else {
      errorMessage.value = '保存失败: ' + e.message
    }
  } finally {
    isSaving.value = false
  }
}

// 继续上传 - 直接触发新的上传
function continueUpload() {
  console.log('继续上传被点击，重置状态')
  // 先重置保存状态
  isSaved.value = false
  isSaving.value = false
  currentRecordId.value = null

  // 重置文件输入以允许选择相同文件
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  // 直接触发文件选择
  fileInput.value?.click()
}

// 重置分析
function resetAnalysis() {
  imageData.value = null
  analysisImageData.value = null
  analysisResult.value = null
  errorMessage.value = null
  originalImageLoaded.value = false
  isSaved.value = false
  currentRecordId.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<style scoped>
.analysis-page {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: var(--background-color);
  position: relative;
}

/* 历史记录按钮 */
.history-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 16px;
  background: var(--primary-color);
  color: white;
  border-radius: 8px;
  font-size: 14px;
  z-index: 100;
  transition: var(--transition-fast);
}

.history-btn:hover {
  opacity: 0.9;
}

/* 返回按钮 */
.back-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  padding: 10px 16px;
  background: rgba(74, 144, 217, 0.6);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  z-index: 100;
  transition: var(--transition-fast);
  cursor: pointer;
}

.back-btn:hover {
  background: rgba(74, 144, 217, 0.8);
  transform: translateX(-2px);
}

/* 个人按钮 */
.profile-btn {
  position: fixed;
  top: 20px;
  right: 140px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.profile-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.profile-btn .avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-btn .avatar-placeholder {
  font-size: 20px;
}

/* 历史记录面板 */
.history-panel {
  position: fixed;
  top: 70px;
  right: 20px;
  width: 300px;
  max-height: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow);
  z-index: 99;
  overflow: hidden;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.history-header h3 {
  font-size: 16px;
  margin: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  background: none;
  font-size: 20px;
  color: var(--text-light);
}

.history-list {
  padding: 16px;
  max-height: 340px;
  overflow-y: auto;
}

.empty-tip {
  color: var(--text-light);
  text-align: center;
}

/* 历史记录项 */
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  transition: var(--transition-fast);
  background: var(--background-color);
}

.history-item:hover {
  background: rgba(74, 144, 217, 0.1);
}

.history-thumb,
.history-info {
  cursor: pointer;
}

.delete-history-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.delete-history-btn:hover {
  opacity: 1;
}

.history-item:last-child {
  margin-bottom: 0;
}

.history-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-type {
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-time {
  font-size: 12px;
  color: var(--text-light);
}

/* 主内容区 */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 40px;
}

/* 上传区 */
.upload-area {
  width: 100%;
  max-width: 600px;
  margin: 100px auto;
  padding: 60px 40px;
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition-fast);
  background: white;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--primary-color);
  background: rgba(74, 144, 217, 0.05);
}

.upload-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 18px;
  color: var(--text-color);
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: var(--text-light);
}

/* 欢迎语 */
.welcome-text {
  font-size: 20px;
  font-weight: 500;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

/* 加载状态 */
.loading-area {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 40px 20px;
}

.loading-content {
  text-align: center;
  background: white;
  padding: 40px 60px;
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  margin: 0 auto 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 18px;
  color: var(--text-color);
  margin-bottom: 8px;
}

.loading-hint {
  font-size: 14px;
  color: var(--text-light);
}

/* 结果展示区 */
.result-area {
  padding: 20px 0;
}

/* 图片对比 */
.image-comparison {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.image-box {
  flex: 1;
  min-width: 300px;
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.image-box h4 {
  margin-bottom: 12px;
  color: var(--text-color);
}

.image-box img,
.image-box canvas {
  width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
}

.canvas-container {
  width: 100%;
  position: relative;
}

.canvas-container canvas {
  width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
}

/* 文字分析结果 */
.analysis-text {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.analysis-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.analysis-item h4 {
  margin-bottom: 10px;
  color: var(--primary-color);
}

.analysis-item p {
  color: var(--text-color);
  line-height: 1.6;
  margin-bottom: 6px;
}

.analysis-item strong {
  color: var(--text-light);
}

/* 按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.save-btn {
  padding: 12px 32px;
  background: #27ae60;
  color: white;
  border-radius: 8px;
  font-size: 16px;
  transition: var(--transition-fast);
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.save-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.reset-btn,
.retry-btn {
  padding: 12px 32px;
  background: var(--primary-color);
  color: white;
  border-radius: 8px;
  font-size: 16px;
  transition: var(--transition-fast);
}

.reset-btn:hover,
.retry-btn:hover {
  opacity: 0.9;
}

.continue-btn {
  padding: 12px 32px;
  background: #3498db;
  color: white;
  border-radius: 8px;
  font-size: 16px;
  transition: var(--transition-fast);
}

.continue-btn:hover {
  opacity: 0.9;
}

/* 错误提示 */
.error-area {
  text-align: center;
  padding: 40px 20px;
}

.error-text {
  color: #e74c3c;
  font-size: 16px;
  margin-bottom: 20px;
}

/* 可点击图片 */
.clickable-image {
  cursor: zoom-in;
}

/* 图片查看器弹窗 */
.image-viewer-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.image-viewer-content {
  position: relative;
  width: 90%;
  height: 90%;
  display: flex;
  flex-direction: column;
}

.viewer-close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
}

.viewer-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.viewer-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-bottom: 10px;
}

.viewer-controls button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.viewer-controls button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.viewer-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.viewer-controls span {
  color: white;
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}

.viewer-image-container {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-image-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
}
</style>
