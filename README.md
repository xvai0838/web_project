# 摄影图片分析应用

一个基于 Vue 3 + Vite 的摄影图片 AI 分析工具，使用豆包视觉模型对照片进行专业的构图、光线、色彩等多维度分析。

## 功能特性

- 📷 **图片上传**：支持拖拽或点击上传 JPG/PNG/WebP 格式图片
- 🤖 **AI 分析**：调用豆包视觉模型进行专业摄影分析
- 📐 **构图分析**：识别构图类型并在图片上绘制构图辅助线
- 💡 **多维度分析**：光线、色彩、主体表达、景别角度、改进建议
- 📋 **历史记录**：保存分析结果，支持查看和删除
- 👤 **用户系统**：注册登录、个人资料管理
- 🔒 **单设备登录**：同一账号只能在一个设备登录

## 快速开始

### 前端启动

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

### 后端启动

```bash
cd server

# 安装依赖
npm install

# 启动服务器
node index.js
```

服务器默认运行在 `http://localhost:3000`

## 项目结构

```
photo-analysis-app/
├── index.html              # 入口 HTML
├── package.json            # 前端依赖配置
├── vite.config.js          # Vite 构建配置
├── style.css               # 全局样式
├── src/
│   ├── main.js             # Vue 应用入口，路由配置
│   ├── App.vue             # 根组件
│   ├── views/              # 页面组件
│   │   ├── WelcomePage.vue      # 欢迎页
│   │   ├── UserLoginPage.vue    # 登录/注册页
│   │   ├── UserProfilePage.vue  # 用户管理页
│   │   └── AnalysisPage.vue     # 图片分析页
│   └── utils/              # 工具函数
│       ├── api.js               # AI 分析 API
│       ├── userApi.js           # 用户认证 API
│       └── userStorage.js       # 本地存储工具
├── server/
│   ├── index.js            # Express 后端服务
│   └── package.json        # 后端依赖配置
└── public/
    └── _redirects          # Netlify 重定向配置
```

## 页面说明

### 欢迎页 (WelcomePage.vue)
- 背景图片轮播（5秒切换）
- 快捷工具栏（可自定义链接）
- 用户头像入口
- 历史记录入口
- "开始使用"按钮
- 登录后显示"更多免费模型"按钮

### 登录页 (UserLoginPage.vue)
- 登录/注册切换
- 表单验证
- 背景图片轮播

### 用户管理页 (UserProfilePage.vue)
- 头像上传
- 昵称、邮箱编辑
- 历史记录列表
- 切换账号功能

### 分析页 (AnalysisPage.vue)
- 图片上传（拖拽/点击）
- AI 分析加载状态
- 原图与分析图对比
- 六维度分析结果展示
- 历史记录面板
- 图片放大查看

## 存储模式切换

项目支持两种存储模式：

### 后端存储模式（默认）
- 数据存储在服务器的 SQLite 数据库
- 支持跨设备同步
- 需要运行后端服务器

### 本地存储模式
- 数据存储在浏览器 localStorage
- 仅当前浏览器可用
- 无需后端服务器

### 切换方法

修改 `src/utils/storage.js` 文件中的 `USE_BACKEND` 变量：

```javascript
// 使用后端存储
const USE_BACKEND = true

// 使用本地存储
const USE_BACKEND = false
```

## API 配置

### AI 分析 API

在 `src/utils/api.js` 中配置豆包 API：

```javascript
const API_CONFIG = {
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-vision-250815',
  apiKey: '你的API密钥'
}
```

### 后端 API

后端使用 Express + SQLite，提供以下接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/register | POST | 用户注册 |
| /api/login | POST | 用户登录 |
| /api/logout | POST | 用户登出 |
| /api/verify | GET | 验证登录状态 |
| /api/user | GET/PUT | 获取/更新用户信息 |
| /api/history | GET/POST | 获取/添加历史记录 |
| /api/history/:id | DELETE | 删除历史记录 |

## 自定义配置

### 修改工具栏链接

在 `src/views/WelcomePage.vue` 中修改 `toolbarItems`：

```javascript
const toolbarItems = ref([
  { name: '名称', icon: '🎵', url: 'https://example.com' },
  // 添加更多...
])
```

### 修改"更多免费模型"链接

在 `src/views/WelcomePage.vue` 中修改：

```javascript
const moreModelsUrl = 'https://你的链接'
```

### 修改背景图片

在各页面组件中修改 `backgroundImages` 数组。

## 技术栈

- **前端**：Vue 3 + Vue Router + Vite
- **后端**：Express + SQLite (better-sqlite3)
- **认证**：JWT Token + bcrypt 密码加密
- **AI**：豆包视觉模型 (doubao-seed-1-6-vision)

## 部署

### Vercel 部署

项目包含 `vercel.json` 配置，支持直接部署到 Vercel。

### Nginx 反向代理

```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

