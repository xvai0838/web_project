import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// 路由配置
const routes = [
  {
    path: '/',
    name: 'Welcome',
    component: () => import('./views/WelcomePage.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/UserLoginPage.vue')
  },
  {
    path: '/user-profile',
    name: 'UserProfile',
    component: () => import('./views/UserProfilePage.vue')
  },
  {
    path: '/app',
    name: 'Analysis',
    component: () => import('./views/AnalysisPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
