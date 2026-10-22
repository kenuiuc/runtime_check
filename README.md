# 运行环境检查（Run Time Check）

一个用于验证离线机器是否具备 **JDK 21 / Maven / Node.js 24 / npm / Vite / Vue 3 / Spring Boot** 运行环境的最小待办清单应用。

- **前端**：Vue 3 + Vite，开发服务器端口 `5173`
- **Node.js 后端**：Express，端口 `3001`，负责**待办事项**的增删改查，数据保存在本地 JSON 文件
- **Spring Boot 后端**：Spring Boot 3.5 + JDK 21，端口 `8080`，负责**分类**的增删改查，数据保存在本地 JSON 文件

前端页面顶部会显示两个后端服务返回的实际运行时版本（Node.js 版本、Java 版本、Spring Boot 版本），用于直接确认离线机器的运行环境是否正常；页面上的待办操作调用 Node.js 服务，分类操作调用 Spring Boot 服务，从而同时验证两条调用链路。

## 目录结构

```
run_time_check/
├── .gitignore
├── README.md
├── backend-node/                 # Node.js 后端（Express）
│   ├── package.json
│   ├── server.js
│   └── data/todos.json           # 运行后自动生成，已被 .gitignore 忽略
├── backend-java/                 # Spring Boot 后端（JDK 21）
│   ├── pom.xml
│   ├── src/main/java/com/example/todobackend/
│   │   ├── TodoBackendApplication.java
│   │   ├── Category.java
│   │   ├── CategoryController.java
│   │   ├── CategoryStore.java
│   │   └── WebConfig.java
│   ├── src/main/resources/application.properties
│   └── data/categories.json      # 运行后自动生成，已被 .gitignore 忽略
└── frontend/                     # Vue 3 前端（Vite）
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js
        ├── App.vue
        ├── api.js
        └── style.css
```

## 环境要求

| 组件 | 要求版本 |
| --- | --- |
| Node.js | 24.x（`package.json` 中已声明 `>=24`） |
| npm | 随 Node.js 安装即可（建议 11 及以上） |
| JDK | 21 |
| Maven | 3.8 及以上 |
| 浏览器 | 任意现代浏览器 |

## 启动步骤

需要打开 **3 个终端**，分别启动 3 个项目。

### 1. 启动 Node.js 后端（端口 3001）

```bash
cd backend-node
npm install
npm start        # 开发模式可用 npm run dev（文件变更自动重启）
```

启动成功会输出：

```
Node.js 后端已启动：http://localhost:3001
待办数据文件：.../backend-node/data/todos.json
```

### 2. 启动 Spring Boot 后端（端口 8080）

```bash
cd backend-java
mvn spring-boot:run
```

也可以先打包再运行：

```bash
mvn -DskipTests package
java -jar target/todo-backend-java-1.0.0.jar
```

### 3. 启动 Vue 3 前端（端口 5173）

```bash
cd frontend
npm install
npm run dev
```

浏览器访问：<http://localhost:5173>

### 生产构建与预览

```bash
cd frontend
npm run build
npm run preview   # http://localhost:4173
```

`npm run dev` 与 `npm run preview` 都已配置接口代理，因此两种方式都可以直接访问后端。

## 接口一览

前端通过 Vite 代理访问后端：

- `/api/node/**` → `http://localhost:3001`（请求时会去掉 `/api/node` 前缀）
- `/api/java/**` → `http://localhost:8080`（请求时会去掉 `/api/java` 前缀）

### Node.js 后端

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/info` | 返回 Node.js 运行环境信息 |
| GET | `/api/todos` | 查询全部待办 |
| POST | `/api/todos` | 新建待办，请求体 `{ "title": "标题", "categoryId": "分类 ID 或 null" }` |
| PUT | `/api/todos/{id}` | 更新待办，可传 `title`、`done`、`categoryId` |
| DELETE | `/api/todos/{id}` | 删除待办 |

### Spring Boot 后端

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/info` | 返回 Java / Spring Boot 运行环境信息 |
| GET | `/api/categories` | 查询全部分类 |
| POST | `/api/categories` | 新建分类，请求体 `{ "name": "分类名称" }` |
| DELETE | `/api/categories/{id}` | 删除分类 |

字段说明：待办包含 `id`、`title`、`done`、`categoryId`、`createdAt`、`updatedAt`；分类包含 `id`、`name`。`categoryId` 为空表示未分类。

## 数据持久化

两个后端都**不使用数据库**，直接读写本地 JSON 文件：

| 服务 | 默认数据文件 |
| --- | --- |
| Node.js 后端 | `backend-node/data/todos.json` |
| Spring Boot 后端 | `backend-java/data/categories.json` |

- 首次启动时目录和文件会自动创建。
- 删除对应 JSON 文件并重启服务即可重置数据。
- Node.js 后端可通过环境变量覆盖配置：`PORT`（端口）、`DATA_DIR`（数据目录）。
- Spring Boot 后端可通过 `application.properties` 中的 `server.port` 与 `app.data-file` 修改端口和数据文件路径。

## 离线 Nexus 配置参考

项目只使用最少且最常见的依赖：

- 前端：`vue`、`vite`、`@vitejs/plugin-vue`
- Node.js 后端：`express`
- Spring Boot 后端：`spring-boot-starter-web`（含 Jackson，用于 JSON 持久化）

### npm 指向内部仓库

在项目目录或用户目录创建 `.npmrc`：

```ini
registry=http://nexus.internal/repository/npm-group/
```

### Maven 指向内部仓库

在 `~/.m2/settings.xml` 中配置镜像（地址替换为实际 Nexus 地址）：

```xml
<settings>
  <mirrors>
    <mirror>
      <id>internal-nexus</id>
      <mirrorOf>*</mirrorOf>
      <url>http://nexus.internal/repository/maven-public/</url>
    </mirror>
  </mirrors>
</settings>
```

### 版本说明

本项目已验证的组合：

| 依赖 | 版本 |
| --- | --- |
| Node.js | 24.x（`package.json` 要求 `>=24`） |
| Vue | 3.5.x |
| Vite | 8.x |
| Express | 4.21.x |
| Spring Boot | 3.5.16 |
| JDK | 21 |

如果内部 Nexus 尚未同步 Vite 8 / Spring Boot 3.5.16，可将 `frontend/package.json` 中的 `vite` 调整为 `^7.3.7`（要求 Node.js 20.19+），或将 `backend-java/pom.xml` 中 `spring-boot-starter-parent` 调整为内部仓库已有的 3.x 版本。修改版本后请重新执行 `npm install` / `mvn clean package`。

## 常见问题

1. **页面提示“未连接，请先启动 backend-node / backend-java”**
   说明对应后端未启动或端口不一致。请确认 Node.js 服务监听 `3001`、Spring Boot 服务监听 `8080`。

2. **端口被占用**
   修改 `backend-node/server.js` 中的 `PORT`（或设置环境变量 `PORT`）、`backend-java/src/main/resources/application.properties` 中的 `server.port`，同时更新 `frontend/vite.config.js` 中的代理目标地址。

3. **构建前端时提示 Node 版本过低**
   本项目要求 Node.js 24，请升级 Node.js 后重新 `npm install`。

4. **直接双击打开 `dist/index.html` 无法使用**
   前端依赖 Vite 代理访问后端，请使用 `npm run dev` 或 `npm run preview` 启动。

5. **接口返回 404**
   请确认请求路径前缀：访问 Node.js 服务用 `/api/node/...`，访问 Spring Boot 服务用 `/api/java/...`。
