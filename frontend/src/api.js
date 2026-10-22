const NODE_BASE = '/api/node'
const JAVA_BASE = '/api/java'

async function request(url, options = {}) {
  let response
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
  } catch {
    throw new Error('无法连接后端服务，请确认服务已启动')
  }

  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const body = await response.json()
      if (body?.message) message = body.message
    } catch {
      // 响应体不是 JSON 时保留默认提示
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export const nodeApi = {
  info: () => request(`${NODE_BASE}/api/info`),
  listTodos: () => request(`${NODE_BASE}/api/todos`),
  createTodo: (todo) =>
    request(`${NODE_BASE}/api/todos`, { method: 'POST', body: JSON.stringify(todo) }),
  updateTodo: (id, changes) =>
    request(`${NODE_BASE}/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(changes) }),
  deleteTodo: (id) => request(`${NODE_BASE}/api/todos/${id}`, { method: 'DELETE' })
}

export const javaApi = {
  info: () => request(`${JAVA_BASE}/api/info`),
  listCategories: () => request(`${JAVA_BASE}/api/categories`),
  createCategory: (category) =>
    request(`${JAVA_BASE}/api/categories`, { method: 'POST', body: JSON.stringify(category) }),
  deleteCategory: (id) => request(`${JAVA_BASE}/api/categories/${id}`, { method: 'DELETE' })
}
