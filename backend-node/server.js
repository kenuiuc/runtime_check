import express from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const DATA_FILE = path.join(DATA_DIR, 'todos.json')
const PORT = Number(process.env.PORT ?? 3001)

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

let todos = []
let saveChain = Promise.resolve()

async function loadTodos() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    todos = Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    todos = []
  }
}

function persistTodos() {
  const snapshot = JSON.stringify(todos, null, 2)
  const tmpFile = `${DATA_FILE}.tmp`
  saveChain = saveChain.then(async () => {
    await writeFile(tmpFile, snapshot, 'utf8')
    await rename(tmpFile, DATA_FILE)
  })
  return saveChain
}

function normalizeTitle(value) {
  if (typeof value !== 'string') return null
  const title = value.trim()
  return title ? title.slice(0, 100) : null
}

app.get('/api/info', (req, res) => {
  res.json({
    service: 'Node.js 后端',
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    time: new Date().toISOString()
  })
})

app.get('/api/todos', (req, res) => {
  res.json(todos)
})

app.post('/api/todos', async (req, res, next) => {
  try {
    const title = normalizeTitle(req.body?.title)
    if (!title) {
      res.status(400).json({ message: '待办标题不能为空' })
      return
    }
    const { categoryId = null } = req.body ?? {}
    if (categoryId !== null && typeof categoryId !== 'string') {
      res.status(400).json({ message: 'categoryId 必须是字符串或 null' })
      return
    }

    const now = new Date().toISOString()
    const todo = {
      id: randomUUID(),
      title,
      done: false,
      categoryId: categoryId || null,
      createdAt: now,
      updatedAt: now
    }
    todos = [todo, ...todos]
    await persistTodos()
    res.status(201).json(todo)
  } catch (error) {
    next(error)
  }
})

app.put('/api/todos/:id', async (req, res, next) => {
  try {
    const todo = todos.find((item) => item.id === req.params.id)
    if (!todo) {
      res.status(404).json({ message: '待办不存在' })
      return
    }

    const { title, done, categoryId } = req.body ?? {}
    if (title !== undefined) {
      const normalized = normalizeTitle(title)
      if (!normalized) {
        res.status(400).json({ message: '待办标题不能为空' })
        return
      }
      todo.title = normalized
    }
    if (done !== undefined) {
      if (typeof done !== 'boolean') {
        res.status(400).json({ message: 'done 必须是布尔值' })
        return
      }
      todo.done = done
    }
    if (categoryId !== undefined) {
      if (categoryId !== null && typeof categoryId !== 'string') {
        res.status(400).json({ message: 'categoryId 必须是字符串或 null' })
        return
      }
      todo.categoryId = categoryId || null
    }

    todo.updatedAt = new Date().toISOString()
    await persistTodos()
    res.json(todo)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/todos/:id', async (req, res, next) => {
  try {
    const before = todos.length
    todos = todos.filter((item) => item.id !== req.params.id)
    if (todos.length === before) {
      res.status(404).json({ message: '待办不存在' })
      return
    }
    await persistTodos()
    res.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' })
})

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ message: '请求体不是合法的 JSON' })
    return
  }
  console.error(error)
  res.status(500).json({ message: '服务器内部错误' })
})

await loadTodos()
app.listen(PORT, () => {
  console.log(`Node.js 后端已启动：http://localhost:${PORT}`)
  console.log(`待办数据文件：${DATA_FILE}`)
})
