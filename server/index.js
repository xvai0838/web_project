const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

// 初始化数据库
const db = new Database(path.join(__dirname, 'data.db'))

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    email TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    device_info TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    record_id TEXT UNIQUE NOT NULL,
    image_data TEXT,
    analysis_image TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// 中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// 验证 token 中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!session) {
    return res.status(401).json({ error: '登录已过期或已在其他设备登录', code: 'SESSION_INVALID' })
  }

  const user = db.prepare('SELECT id, username, nickname, avatar, email FROM users WHERE id = ?').get(session.user_id)
  if (!user) {
    return res.status(401).json({ error: '用户不存在' })
  }

  req.user = user
  req.token = token
  next()
}

// ==================== 用户认证 API ====================

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度需要3-20个字符' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6个字符' })
    }

    // 检查用户名是否存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword)

    // 创建会话
    const token = uuidv4()
    const deviceInfo = req.headers['user-agent'] || ''
    db.prepare('INSERT INTO sessions (user_id, token, device_info) VALUES (?, ?, ?)').run(result.lastInsertRowid, token, deviceInfo)

    res.json({
      success: true,
      token,
      user: {
        id: result.lastInsertRowid,
        username,
        nickname: '',
        avatar: '',
        email: ''
      }
    })
  } catch (error) {
    console.error('注册错误:', error)
    res.status(500).json({ error: '注册失败' })
  }
})

// 登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    // 删除该用户的所有旧会话（实现单设备登录限制）
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)

    // 创建新会话
    const token = uuidv4()
    const deviceInfo = req.headers['user-agent'] || ''
    db.prepare('INSERT INTO sessions (user_id, token, device_info) VALUES (?, ?, ?)').run(user.id, token, deviceInfo)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        email: user.email || ''
      }
    })
  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ error: '登录失败' })
  }
})

// 登出
app.post('/api/logout', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token)
  res.json({ success: true })
})

// 验证 token
app.get('/api/verify', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user })
})

// ==================== 用户信息 API ====================

// 获取用户信息
app.get('/api/user', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user })
})

// 更新用户信息
app.put('/api/user', authMiddleware, (req, res) => {
  try {
    const { nickname, avatar, email } = req.body
    
    db.prepare('UPDATE users SET nickname = ?, avatar = ?, email = ? WHERE id = ?')
      .run(nickname || '', avatar || '', email || '', req.user.id)

    res.json({
      success: true,
      user: {
        ...req.user,
        nickname: nickname || '',
        avatar: avatar || '',
        email: email || ''
      }
    })
  } catch (error) {
    console.error('更新用户信息错误:', error)
    res.status(500).json({ error: '更新失败' })
  }
})


// ==================== 历史记录 API ====================

// 获取历史记录
app.get('/api/history', authMiddleware, (req, res) => {
  try {
    const records = db.prepare(`
      SELECT record_id as id, image_data as imageData, analysis_image as analysisImage, 
             result, created_at as timestamp
      FROM history 
      WHERE user_id = ? 
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id)

    // 解析 result JSON
    const parsed = records.map(r => ({
      ...r,
      result: r.result ? JSON.parse(r.result) : null,
      timestamp: new Date(r.timestamp).getTime()
    }))

    res.json({ success: true, records: parsed })
  } catch (error) {
    console.error('获取历史记录错误:', error)
    res.status(500).json({ error: '获取失败' })
  }
})

// 添加历史记录
app.post('/api/history', authMiddleware, (req, res) => {
  try {
    const { imageData, analysisImage, result } = req.body
    
    if (!imageData || !result) {
      return res.status(400).json({ error: '数据不完整' })
    }

    // 检查记录数量限制
    const count = db.prepare('SELECT COUNT(*) as count FROM history WHERE user_id = ?').get(req.user.id)
    if (count.count >= 50) {
      return res.status(400).json({ error: '历史记录已达上限(50条)，请先删除旧记录' })
    }

    const recordId = uuidv4()
    db.prepare(`
      INSERT INTO history (user_id, record_id, image_data, analysis_image, result)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, recordId, imageData, analysisImage || '', JSON.stringify(result))

    res.json({
      success: true,
      record: {
        id: recordId,
        imageData,
        analysisImage,
        result,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    console.error('添加历史记录错误:', error)
    res.status(500).json({ error: '保存失败' })
  }
})

// 删除历史记录
app.delete('/api/history/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    db.prepare('DELETE FROM history WHERE record_id = ? AND user_id = ?').run(id, req.user.id)
    res.json({ success: true })
  } catch (error) {
    console.error('删除历史记录错误:', error)
    res.status(500).json({ error: '删除失败' })
  }
})

// 清理过期记录（24小时）
app.post('/api/history/cleanup', authMiddleware, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM history 
      WHERE user_id = ? AND created_at < datetime('now', '-24 hours')
    `).run(req.user.id)
    
    res.json({ success: true, deleted: result.changes })
  } catch (error) {
    console.error('清理历史记录错误:', error)
    res.status(500).json({ error: '清理失败' })
  }
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})
