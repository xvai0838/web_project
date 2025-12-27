<template>
  <div class="welcome-page">
    <!-- 背景轮播图片 -->
    <div class="background-carousel">
      <div 
        v-for="(image, index) in backgroundImages" 
        :key="index"
        class="background-image"
        :class="{ active: currentImageIndex === index }"
        :style="{ backgroundImage: `url(${image})` }"
      ></div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <a 
        v-for="(item, index) in toolbarItems" 
        :key="index"
        :href="item.url"
        target="_blank"
        class="toolbar-item"
      >
        <span class="toolbar-icon">{{ item.icon }}</span>
        <span class="toolbar-name">{{ item.name }}</span>
      </a>
    </div>

    <!-- 个人按钮 -->
    <div class="profile-btn" @click="goToProfile">
      <img v-if="userAvatar" :src="userAvatar" alt="头像" class="avatar-img" />
      <span v-else class="avatar-placeholder">👤</span>
    </div>

    <!-- 历史记录按钮 -->
    <button class="history-btn" @click="toggleHistory">
      📋 历史记录
    </button>

    <!-- 历史记录面板 -->
    <div v-if="showHistory" class="history-panel">
      <div class="history-header">
        <h3>历史记录 ({{ historyRecords.length }}/50)</h3>
        <button class="close-btn" @click="showHistory = false">×</button>
      </div>
      <div class="history-list">
        <p v-if="!isUserLoggedIn" class="empty-tip">请先登录查看历史记录</p>
        <p v-else-if="historyRecords.length === 0" class="empty-tip">暂无历史记录</p>
        <div
          v-for="record in historyRecords"
          :key="record.id"
          class="history-item"
        >
          <img :src="record.imageData" alt="历史图片" class="history-thumb" @click.stop="openImageViewer(record.imageData)" />
          <div class="history-info" @click="viewHistoryInApp(record)">
            <p class="history-type">{{ record.result?.composition?.type || '未知构图' }}</p>
            <p class="history-time">{{ formatTime(record.timestamp) }}</p>
          </div>
          <button class="delete-history-btn" @click.stop="deleteRecord(record.id)" title="删除">🗑️</button>
        </div>
      </div>
    </div>

    <!-- 图片放大查看弹窗 -->
    <div v-if="showImageViewer" class="image-viewer-modal" @click.self="closeImageViewer">
      <div class="image-viewer-content">
        <button class="viewer-close-btn" @click="closeImageViewer">×</button>
        <div class="viewer-image-container">
          <img :src="viewerImageSrc" />
        </div>
      </div>
    </div>

    <!-- 历史记录详情弹窗 -->
    <div v-if="showDetail" class="detail-modal" @click.self="closeDetail">
      <div class="detail-content">
        <button class="detail-close-btn" @click="closeDetail">×</button>
        <h3>{{ selectedHistory?.result?.composition?.type || '图片分析' }}</h3>
        <p class="detail-date">{{ selectedHistory ? formatTime(selectedHistory.timestamp) : '' }}</p>
        <div class="detail-images">
          <div class="detail-image-box">
            <h4>原图</h4>
            <img 
              v-if="selectedHistory?.imageData" 
              :src="selectedHistory.imageData" 
              alt="原图" 
              @click="openImageViewer(selectedHistory.imageData)"
              class="clickable-image"
            />
          </div>
          <div class="detail-image-box">
            <h4>分析图</h4>
            <img 
              v-if="selectedHistory?.analysisImage" 
              :src="selectedHistory.analysisImage" 
              alt="分析图" 
              @click="openImageViewer(selectedHistory.analysisImage)"
              class="clickable-image"
            />
          </div>
        </div>
        <div class="detail-analysis" v-if="selectedHistory?.result">
          <div class="analysis-item">
            <h4>📐 构图分析</h4>
            <p>{{ selectedHistory.result.composition?.description || '无' }}</p>
          </div>
          <div class="analysis-item">
            <h4>💡 光线分析</h4>
            <p>{{ selectedHistory.result.lighting || '无' }}</p>
          </div>
          <div class="analysis-item">
            <h4>🎨 色彩分析</h4>
            <p>{{ selectedHistory.result.color || '无' }}</p>
          </div>
          <div class="analysis-item">
            <h4>🎯 主体表达</h4>
            <p>{{ selectedHistory.result.subject || '无' }}</p>
          </div>
          <div class="analysis-item">
            <h4>📷 景别与角度</h4>
            <p>{{ selectedHistory.result.perspective || '无' }}</p>
          </div>
          <div class="analysis-item" v-if="selectedHistory.result.improvement">
            <h4>💡 不足与提升</h4>
            <p>{{ selectedHistory.result.improvement }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 开始使用按钮 -->
    <button class="start-button" @click="goToApp">
      开始使用
    </button>

    <!-- 更多免费模型按钮 - 仅登录后显示 -->
    <a 
      v-if="isUserLoggedIn" 
      :href="moreModelsUrl" 
      target="_blank" 
      class="more-models-btn"
    >
      <span class="more-models-icon">🐙</span>
      <span class="more-models-text">更多免费模型</span>
    </a>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  isLoggedIn, 
  getCachedUser, 
  verifyAuth,
  getHistoryRecords as getHistoryFromServer,
  deleteHistoryRecord as deleteHistoryFromServer
} from '../utils/userApi.js'

const router = useRouter()

// 用户头像
const userAvatar = ref('')

// 用户登录状态
const isUserLoggedIn = ref(false)

// 历史记录
const showHistory = ref(false)
const historyRecords = ref([])

// 历史记录详情
const showDetail = ref(false)
const selectedHistory = ref(null)

// 图片查看器
const showImageViewer = ref(false)
const viewerImageSrc = ref('')

// ========== 在这里修改跳转网址 ==========
const moreModelsUrl = 'https://api.gemai.cc'  // 
// ========================================

// 背景轮播图片（使用占位图片URL）
const backgroundImages = ref([
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80'
])

const currentImageIndex = ref(0)
let carouselInterval = null

// 工具栏配置 - 在此处添加/删除快捷方式
const toolbarItems = ref([
  { name: '无损音乐', icon: '🎵', url: 'https://www.flac.life/' },
  { name: 'drivenlisten', icon: '🖼️', url: 'https://drivenlisten.com/city' },
  { name: 'Yandex', icon: '🌐', url: 'https://yandex.eu' },
  { name: 'GitHub', icon: '💻', url: 'https://github.com' }
])

// 切换背景图片
const switchImage = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % backgroundImages.value.length
}

// 跳转到应用页面
const goToApp = () => {
  if (!isLoggedIn()) {
    router.push('/login')
  } else {
    router.push('/app')
  }
}

// 跳转到个人页面
const goToProfile = () => {
  if (!isLoggedIn()) {
    router.push('/login')
  } else {
    router.push('/user-profile')
  }
}

// 切换历史记录面板
const toggleHistory = async () => {
  if (!isLoggedIn()) {
    router.push('/login')
    return
  }
  showHistory.value = !showHistory.value
  if (showHistory.value) {
    await loadHistoryRecords()
  }
}

// 加载历史记录
const loadHistoryRecords = async () => {
  try {
    const records = await getHistoryFromServer()
    historyRecords.value = records.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('加载历史记录失败:', error)
  }
}

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}月${day}日 ${hours}:${minutes}`
}

// 删除历史记录
const deleteRecord = async (id) => {
  if (confirm('确定要删除这条历史记录吗？')) {
    try {
      await deleteHistoryFromServer(id)
      await loadHistoryRecords()
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }
}

// 在分析页查看历史记录详情
const viewHistoryInApp = (record) => {
  selectedHistory.value = record
  showDetail.value = true
}

// 关闭详情弹窗
const closeDetail = () => {
  showDetail.value = false
  selectedHistory.value = null
}

// 打开图片查看器
const openImageViewer = (imageSrc) => {
  viewerImageSrc.value = imageSrc
  showImageViewer.value = true
}

// 关闭图片查看器
const closeImageViewer = () => {
  showImageViewer.value = false
  viewerImageSrc.value = ''
}

onMounted(async () => {
  // 每5秒切换一次背景图片
  carouselInterval = setInterval(switchImage, 5000)
  
  // 检查登录状态并加载用户头像
  if (isLoggedIn()) {
    isUserLoggedIn.value = true
    try {
      await verifyAuth()
      const user = getCachedUser()
      if (user?.avatar) {
        userAvatar.value = user.avatar
      }
    } catch (e) {
      // 忽略错误
    }
  }
})

onUnmounted(() => {
  if (carouselInterval) {
    clearInterval(carouselInterval)
  }
})
</script>

<style scoped>
.welcome-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 背景轮播 */
.background-carousel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity 3s ease;
}

.background-image.active {
  opacity: 1;
}

/* 工具栏 */
.toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  display: flex;
  gap: 15px;
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-color);
  transition: transform 0.2s ease, background 0.2s ease;
}

.toolbar-item:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.95);
  text-decoration: none;
}

.toolbar-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.toolbar-name {
  font-size: 12px;
  color: var(--text-light);
}

/* 开始使用按钮 */
.start-button {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 15px 50px;
  font-size: 18px;
  font-weight: 500;
  color: #fff;
  background: rgba(74, 144, 217, 0.8);
  border-radius: 30px;
  transition: background 0.3s ease, transform 0.2s ease;
}

.start-button:hover {
  background: rgba(74, 144, 217, 0.95);
  transform: translateX(-50%) scale(1.05);
}

/* 个人按钮 */
.profile-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
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

/* 历史记录按钮 */
.history-btn {
  position: absolute;
  top: 20px;
  right: 80px;
  z-index: 10;
  padding: 10px 16px;
  background: rgba(106, 114, 230, 0.85);
  color: var(--text-color);
  border-radius: 8px;
  font-size: 14px;
  transition: transform 0.2s ease, background 0.2s ease;
  cursor: pointer;
}

.history-btn:hover {
  transform: translateY(-2px);
  background: rgba(250, 250, 255, 0.95);
}

/* 历史记录面板 */
.history-panel {
  position: absolute;
  top: 70px;
  right: 20px;
  width: 320px;
  max-height: 450px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: 100;
  overflow: hidden;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.history-header h3 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.close-btn {
  width: 28px;
  height: 28px;
  background: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  border: none;
}

.close-btn:hover {
  color: #333;
}

.history-list {
  padding: 12px;
  max-height: 380px;
  overflow-y: auto;
}

.empty-tip {
  color: #999;
  text-align: center;
  padding: 30px 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  transition: background 0.2s;
}

.history-item:hover {
  background: rgba(74, 144, 217, 0.1);
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
  cursor: pointer;
}

.history-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.history-type {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-time {
  font-size: 12px;
  color: #999;
}

.delete-history-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.4;
  flex-shrink: 0;
}

.delete-history-btn:hover {
  opacity: 1;
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
  max-width: 90%;
  max-height: 90%;
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
}

.viewer-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.viewer-image-container img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}

/* 更多免费模型按钮 */
.more-models-btn {
  position: absolute;
  bottom: 40px;
  right: 40px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background: rgba(220, 53, 69, 0.7);
  border-radius: 25px;
  text-decoration: none;
  overflow: hidden;
  transition: width 0.3s ease, background 0.3s ease;
  cursor: pointer;
}

.more-models-btn:hover {
  width: 180px;
  background: rgba(220, 53, 69, 0.85);
  text-decoration: none;
}

.more-models-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.more-models-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  margin-left: 8px;
  opacity: 0;
  width: 0;
  overflow: hidden;
  transition: opacity 0.3s ease, width 0.3s ease;
}

.more-models-btn:hover .more-models-text {
  opacity: 1;
  width: auto;
}

/* 历史记录详情弹窗 */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
}

.detail-content {
  position: relative;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 30px;
  border-radius: 16px;
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
}

.detail-close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.1);
  border: none;
  border-radius: 50%;
  font-size: 20px;
  color: #666;
  cursor: pointer;
}

.detail-close-btn:hover {
  background: rgba(0, 0, 0, 0.2);
  color: #333;
}

.detail-content h3 {
  margin-bottom: 8px;
  color: #333;
  font-size: 20px;
}

.detail-date {
  font-size: 13px;
  color: #888;
  margin-bottom: 20px;
}

.detail-images {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.detail-image-box {
  flex: 1;
  min-width: 0;
}

.detail-image-box h4 {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.detail-image-box img {
  width: 100%;
  border-radius: 8px;
  cursor: zoom-in;
}

.detail-analysis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.detail-analysis .analysis-item {
  background: rgba(74, 144, 217, 0.08);
  padding: 14px;
  border-radius: 10px;
}

.detail-analysis .analysis-item h4 {
  font-size: 14px;
  color: #4a90d9;
  margin-bottom: 8px;
}

.detail-analysis .analysis-item p {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  margin: 0;
}

.clickable-image {
  cursor: zoom-in;
}
</style>
