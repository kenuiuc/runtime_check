<script setup>
import { computed, onMounted, ref } from 'vue'
import { javaApi, nodeApi } from './api.js'

const todos = ref([])
const categories = ref([])
const newTodoTitle = ref('')
const newTodoCategory = ref('')
const newCategoryName = ref('')
const runtime = ref({ node: null, java: null })
const error = ref('')
const busy = ref(false)

const remaining = computed(() => todos.value.filter((todo) => !todo.done).length)

async function run(action) {
  error.value = ''
  busy.value = true
  try {
    await action()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function loadData() {
  await run(async () => {
    const [todoList, categoryList] = await Promise.all([
      nodeApi.listTodos(),
      javaApi.listCategories()
    ])
    todos.value = todoList
    categories.value = categoryList
  })
}

async function loadRuntime() {
  const [node, java] = await Promise.allSettled([nodeApi.info(), javaApi.info()])
  runtime.value = {
    node: node.status === 'fulfilled' ? node.value : null,
    java: java.status === 'fulfilled' ? java.value : null
  }
}

async function addTodo() {
  const title = newTodoTitle.value.trim()
  if (!title) {
    error.value = '请输入待办内容'
    return
  }
  await run(async () => {
    const todo = await nodeApi.createTodo({
      title,
      categoryId: newTodoCategory.value || null
    })
    todos.value = [todo, ...todos.value]
    newTodoTitle.value = ''
  })
}

async function toggleTodo(todo) {
  await run(async () => {
    const updated = await nodeApi.updateTodo(todo.id, { done: !todo.done })
    todos.value = todos.value.map((item) => (item.id === updated.id ? updated : item))
  })
}

async function changeCategory(todo, event) {
  await run(async () => {
    const updated = await nodeApi.updateTodo(todo.id, {
      categoryId: event.target.value || null
    })
    todos.value = todos.value.map((item) => (item.id === updated.id ? updated : item))
  })
}

async function removeTodo(todo) {
  await run(async () => {
    await nodeApi.deleteTodo(todo.id)
    todos.value = todos.value.filter((item) => item.id !== todo.id)
  })
}

async function addCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    error.value = '请输入分类名称'
    return
  }
  await run(async () => {
    const category = await javaApi.createCategory({ name })
    categories.value = [...categories.value, category]
    newCategoryName.value = ''
  })
}

async function removeCategory(category) {
  if (!confirm(`确定删除分类「${category.name}」吗？该分类下的待办会显示为未分类。`)) return
  await run(async () => {
    await javaApi.deleteCategory(category.id)
    categories.value = categories.value.filter((item) => item.id !== category.id)
    if (newTodoCategory.value === category.id) newTodoCategory.value = ''
  })
}

onMounted(async () => {
  await loadData()
  await loadRuntime()
})
</script>

<template>
  <main class="app">
    <header class="header">
      <h1>待办清单</h1>
      <p class="subtitle">Vue 3 前端 · Node.js 后端 · Spring Boot 后端</p>
    </header>

    <section class="runtime">
      <article class="runtime-card">
        <h2>Node.js 服务</h2>
        <template v-if="runtime.node">
          <p>版本：{{ runtime.node.nodeVersion }}</p>
          <p>平台：{{ runtime.node.platform }}</p>
        </template>
        <p v-else class="muted">未连接，请先启动 backend-node</p>
      </article>
      <article class="runtime-card">
        <h2>Spring Boot 服务</h2>
        <template v-if="runtime.java">
          <p>Java：{{ runtime.java.javaVersion }}</p>
          <p>Spring Boot：{{ runtime.java.springBootVersion }}</p>
        </template>
        <p v-else class="muted">未连接，请先启动 backend-java</p>
      </article>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="panel">
      <form class="form-row" @submit.prevent="addTodo">
        <input v-model="newTodoTitle" maxlength="100" placeholder="要做什么？" />
        <select v-model="newTodoCategory" aria-label="选择分类">
          <option value="">未分类</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <button type="submit" :disabled="busy">添加</button>
      </form>

      <p class="stats">共 {{ todos.length }} 项，未完成 {{ remaining }} 项</p>

      <ul v-if="todos.length" class="todo-list">
        <li v-for="todo in todos" :key="todo.id" :class="{ done: todo.done }">
          <label class="todo-main">
            <input type="checkbox" :checked="todo.done" @change="toggleTodo(todo)" />
            <span class="todo-title">{{ todo.title }}</span>
          </label>
          <select
            :value="todo.categoryId || ''"
            aria-label="修改分类"
            @change="changeCategory(todo, $event)"
          >
            <option value="">未分类</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <button class="ghost" type="button" @click="removeTodo(todo)">删除</button>
        </li>
      </ul>
      <p v-else class="muted">暂无待办，先添加一条吧。</p>
    </section>

    <section class="panel">
      <h2>分类管理（Spring Boot 服务）</h2>
      <form class="form-row" @submit.prevent="addCategory">
        <input v-model="newCategoryName" maxlength="30" placeholder="新分类名称" />
        <button type="submit" :disabled="busy">添加分类</button>
      </form>
      <ul v-if="categories.length" class="category-list">
        <li v-for="category in categories" :key="category.id">
          <span>{{ category.name }}</span>
          <button class="ghost" type="button" @click="removeCategory(category)">删除</button>
        </li>
      </ul>
      <p v-else class="muted">暂无分类。</p>
    </section>

    <footer class="footer">
      <span>待办与分类分别保存在两个后端服务本地的 JSON 文件中。</span>
      <button class="ghost" type="button" :disabled="busy" @click="loadData">刷新</button>
    </footer>
  </main>
</template>
