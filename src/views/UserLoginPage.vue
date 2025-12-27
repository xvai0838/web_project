<template>
  <div class="user-login-page">
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

    <!-- 返回首页按钮 -->
    <button class="back-home-btn" @click="goHome">
      ← 返回首页
    </button>

    <!-- 登录/注册表单 -->
    <div class="auth-container">
      <h2 class="auth-title">{{ isLogin ? '用户登录' : '用户注册' }}</h2>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <input 
            v-model="username" 
            type="text" 
            placeholder="用户名"
            class="form-input"
            required
          />
        </div>
        
        <div class="form-group">
          <input 
            v-model="password" 
            type="password" 
            placeholder="密码"
            class="form-input"
            required
          />
        </div>

        <div v-if="!isLogin" class="form-group">
          <input 
            v-model="confirmPassword" 
            type="password" 
            placeholder="确认密码"
            class="form-input"
            required
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      </form>

      <p class="switch-mode">
        {{ isLogin ? '没有账号？' : '已有账号？' }}
        <span @click="toggleMode" class="switch-link">
          {{ isLogin ? '立即注册' : '立即登录' }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '../utils/userApi.js'

const router = useRouter()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMsg = ref('')

// 背景轮播图片
const backgroundImages = ref([
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80'
])

const currentImageIndex = ref(0)
let carouselInterval = null

const switchImage = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % backgroundImages.value.length
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  password.value = ''
  confirmPassword.value = ''
  errorMsg.value = ''
}

const goHome = () => {
  router.push('/')
}

const handleSubmit = async () => {
  errorMsg.value = ''
  
  if (!username.value || !password.value) {
    errorMsg.value = '请填写用户名和密码'
    return
  }

  if (!isLogin.value && password.value !== confirmPassword.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }

  isLoading.value = true

  try {
    if (isLogin.value) {
      // 登录
      await login(username.value, password.value)
    } else {
      // 注册
      await register(username.value, password.value)
    }
    // 登录/注册成功，跳转到用户管理页
    router.push('/user-profile')
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  carouselInterval = setInterval(switchImage, 5000)
})

onUnmounted(() => {
  if (carouselInterval) {
    clearInterval(carouselInterval)
  }
})
</script>


<style scoped>
.user-login-page {
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

/* 登录容器 */
.auth-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 380px;
  padding: 40px 30px;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  z-index: 10;
}

.auth-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
  font-weight: 500;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  width: 100%;
}

.form-input {
  width: 100%;
  padding: 14px 18px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.4);
  font-size: 15px;
  color: #333;
  transition: background 0.3s ease;
}

.form-input::placeholder {
  color: rgba(102, 102, 102, 0.7);
}

.form-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.6);
}

.submit-btn {
  width: 100%;
  padding: 14px;
  margin-top: 10px;
  background: rgba(74, 144, 217, 0.8);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background: rgba(74, 144, 217, 0.95);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-msg {
  color: #e74c3c;
  text-align: center;
  font-size: 14px;
  margin-top: 10px;
}

.switch-mode {
  text-align: center;
  margin-top: 20px;
  color: rgba(51, 51, 51, 0.8);
  font-size: 14px;
}

.switch-link {
  color: #4a90d9;
  cursor: pointer;
  font-weight: 500;
}

.switch-link:hover {
  text-decoration: underline;
}

/* 返回首页按钮 */
.back-home-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  padding: 10px 20px;
  font-size: 14px;
  color: #333;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  transition: transform 0.2s ease, background 0.2s ease;
}

.back-home-btn:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.95);
}
</style>
