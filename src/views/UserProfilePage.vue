<template>
  <div class="user-profile-page">
    <!-- 背景图片 -->
    <div class="background-image"></div>

    <!-- 返回首页按钮 -->
    <button class="back-home-btn" @click="goHome">
      ← 返回首页
    </button>

    <!-- 切换账号按钮 -->
    <button class="switch-account-btn" @click="switchAccount">
      🔄 切换账号
    </button>

    <!-- 用户信息容器 -->
    <div class="profile-container">
      <h2 class="profile-title">用户管理</h2>
      
      <!-- 上部分：用户信息 -->
      <div class="user-info-section">
        <div class="avatar-section">
          <div class="avatar-preview" @click="triggerAvatarUpload">
            <img v-if="userInfo.avatar" :src="userInfo.avatar" alt="头像" />
            <span v-else class="avatar-placeholder">+</span>
          </div>
          <input 
            ref="avatarInput"
            type="file" 
            accept="image/*" 
            @change="handleAvatarChange"
            style="display: none"
          />
          <span class="avatar-hint">点击更换头像</span>
        </div>

        <div class="info-fields">
          <div class="form-group">
            <label>昵称</label>
            <input v-model="userInfo.nickname" type="text" placeholder="请输入昵称" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="userInfo.email" type="email" placeholder="请输入邮箱" />
          </div>
        </div>
      </div>

      <!-- 下部分：历史记录 -->
      <div class="history-section">
        <h3 class="section-title">历史记录</h3>
        <div class="history-list" v-if="historyRecords.length > 0">
          <div 
            v-for="record in historyRecords" 
            :key="record.id"
            class="history-item"
            @click="viewHistoryDetail(record)"
          >
            <img :src="record.imageData" alt="历史图片" class="history-thumb" />
            <div class="history-info">
              <span class="history-title">{{ record.result?.composition?.type || '未知构图' }}</span>
              <span class="history-date">{{ formatTime(record.timestamp) }}</span>
            </div>
            <button class="delete-btn" @click.stop="deleteRecord(record.id)">🗑️</button>
          </div>
        </div>
        <div v-else class="no-history">暂无历史记录</div>
      </div>

      <!-- 完成按钮 -->
      <button class="complete-btn" @click="saveAndGoToApp" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '完成' }}
      </button>
    </div>

    <!-- 历史详情弹窗 -->
    <div v-if="showDetail" class="detail-modal" @click.self="closeDetail">
      <div class="detail-content">
        <h3>{{ selectedHistory?.result?.composition?.type || '图片分析' }}</h3>
        <p class="detail-date">{{ selectedHistory ? formatTime(selectedHistory.timestamp) : '' }}</p>
        <div class="detail-images">
          <img 
            v-if="selectedHistory?.imageData" 
            :src="selectedHistory.imageData" 
            alt="原图" 
            @click="openImageViewer(selectedHistory.imageData)"
            class="clickable-image"
          />
          <img 
            v-if="selectedHistory?.analysisImage" 
            :src="selectedHistory.analysisImage" 
            alt="分析图" 
            @click="openImageViewer(selectedHistory.analysisImage)"
            class="clickable-image"
          />
        </div>
        <div class="detail-analysis" v-if="selectedHistory?.result">
          <p><strong>构图：</strong>{{ selectedHistory.result.composition?.description || '无' }}</p>
          <p><strong>光线：</strong>{{ selectedHistory.result.lighting || '无' }}</p>
          <p><strong>色彩：</strong>{{ selectedHistory.result.color || '无' }}</p>
        </div>
        <button @click="closeDetail" class="close-btn">关闭</button>
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
        <div class="viewer-image-container">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  verifyAuth, 
  getCachedUser, 
  updateUserInfo, 
  logout,
  getHistoryRecords as getHistoryFromServer,
  deleteHistoryRecord as deleteHistoryFromServer
} from '../utils/userApi.js'

const router = useRouter()
const avatarInput = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)

const userInfo = ref({
  nickname: '',
  avatar: '',
  email: ''
})

// 使用统一的历史记录
const historyRecords = ref([])

const showDetail = ref(false)
const selectedHistory = ref(null)

// 图片查看器状态
const showImageViewer = ref(false)
const viewerImageSrc = ref('')
const zoomLevel = ref(1)

const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      userInfo.value.avatar = event.target.result
    }
    reader.readAsDataURL(file)
  }
}

const viewHistoryDetail = (item) => {
  selectedHistory.value = item
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedHistory.value = null
}

// 打开图片查看器
const openImageViewer = (imageSrc) => {
  viewerImageSrc.value = imageSrc
  zoomLevel.value = 1
  showImageViewer.value = true
}

// 关闭图片查看器
const closeImageViewer = () => {
  showImageViewer.value = false
  viewerImageSrc.value = ''
}

// 放大
const zoomIn = () => {
  if (zoomLevel.value < 3) {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.25)
  }
}

// 缩小
const zoomOut = () => {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.25)
  }
}

// 重置缩放
const resetZoom = () => {
  zoomLevel.value = 1
}

// 鼠标滚轮缩放
const handleWheel = (e) => {
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const goHome = () => {
  router.push('/')
}

// 切换账号
const switchAccount = async () => {
  if (confirm('确定要切换账号吗？当前账号将退出登录。')) {
    await logout()
    router.push('/login')
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

// 加载历史记录
const loadHistoryRecords = async () => {
  try {
    const records = await getHistoryFromServer()
    historyRecords.value = records.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('加载历史记录失败:', error)
  }
}

const saveAndGoToApp = async () => {
  isSaving.value = true
  try {
    await updateUserInfo({
      nickname: userInfo.value.nickname,
      avatar: userInfo.value.avatar,
      email: userInfo.value.email
    })
    router.push('/app')
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    // 验证登录状态
    const result = await verifyAuth()
    if (!result.success) {
      router.push('/login')
      return
    }
    
    // 加载用户信息
    const user = getCachedUser()
    if (user) {
      userInfo.value = {
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        email: user.email || ''
      }
    }
    
    // 加载历史记录
    await loadHistoryRecords()
  } catch (error) {
    console.error('初始化失败:', error)
    router.push('/login')
  } finally {
    isLoading.value = false
  }
})
</script>


<style scoped>
.user-profile-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/preview.jpg');
  background-size: cover;
  background-position: center;
  z-index: 0;
}

.profile-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  padding: 30px;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  z-index: 10;
  overflow-y: auto;
}

.profile-title {
  text-align: center;
  margin-bottom: 25px;
  color: rgba(51, 51, 51, 0.7);
  font-size: 24px;
}

.user-info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  border: 2px dashed rgba(74, 144, 217, 0.5);
  transition: border-color 0.3s;
}

.avatar-preview:hover {
  border-color: rgba(74, 144, 217, 0.8);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 32px;
  color: rgba(74, 144, 217, 0.7);
}

.avatar-hint {
  font-size: 12px;
  color: rgba(102, 102, 102, 0.7);
}

.info-fields {
  width: 100%;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: rgba(51, 51, 51, 0.7);
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  color: #333;
  transition: background 0.3s;
}

.form-group input::placeholder {
  color: rgba(102, 102, 102, 0.6);
}

.form-group input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.6);
}

.history-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  color: rgba(51, 51, 51, 0.7);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(221, 221, 221, 0.5);
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.5);
}

.history-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.history-date {
  font-size: 12px;
  color: rgba(102, 102, 102, 0.7);
}

.history-title {
  font-size: 14px;
  color: rgba(51, 51, 51, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.5;
  flex-shrink: 0;
}

.delete-btn:hover {
  opacity: 1;
}

.no-history {
  text-align: center;
  color: rgba(102, 102, 102, 0.6);
  padding: 20px;
  font-size: 14px;
}

.complete-btn {
  width: 100%;
  padding: 14px;
  background: rgba(74, 144, 217, 0.7);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.complete-btn:hover {
  background: rgba(74, 144, 217, 0.9);
}

/* 历史详情弹窗 */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.detail-content {
  background: rgba(255, 255, 255, 0.95);
  padding: 25px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-content h3 {
  margin-bottom: 10px;
  color: #333;
}

.detail-date {
  font-size: 12px;
  color: #666;
  margin-bottom: 15px;
}

.detail-images {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.detail-images img {
  flex: 1;
  max-width: 48%;
  border-radius: 8px;
  object-fit: cover;
}

.detail-analysis {
  margin-bottom: 15px;
}

.detail-analysis p {
  color: #444;
  line-height: 1.6;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-desc {
  color: #444;
  line-height: 1.6;
  margin-bottom: 20px;
}

.close-btn {
  width: 100%;
  padding: 10px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* 返回首页按钮 */
.back-home-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  padding: 10px 20px;
  font-size: 14px;
  color: #fff;
  background: rgba(74, 144, 217, 0.6);
  border-radius: 8px;
  transition: transform 0.2s ease, background 0.2s ease;
}

.back-home-btn:hover {
  transform: translateY(-2px);
  background: rgba(74, 144, 217, 0.8);
}

/* 切换账号按钮 */
.switch-account-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  padding: 10px 20px;
  font-size: 14px;
  color: rgba(51, 51, 51, 0.8);
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  transition: transform 0.2s ease, background 0.2s ease;
}

.switch-account-btn:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.7);
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
