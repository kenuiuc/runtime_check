# 生产环境部署指南

本文档说明如何把本项目的 3 个服务（Vue 3 前端、Node.js 后端、Spring Boot 后端）部署到一台生产服务器上。

项目本身非常轻量，推荐的单机部署结构如下：

```
浏览器
  │
  ▼
Nginx (80 / 443)
  ├── /                → 前端静态文件（frontend/dist）
  ├── /api/node/...    → 反向代理到 Node.js 后端  127.0.0.1:3001
  └── /api/java/...    → 反向代理到 Spring Boot   127.0.0.1:8080
```

采用「Nginx 统一入口 + 两个后端只监听本机回环地址」的方式，可以做到：

- 前端与接口同源，浏览器不会产生跨域请求；
- 两个后端都不直接暴露到公网，降低攻击面；
- 前端不需要改代码，仍使用 `/api/node/**`、`/api/java/**` 两个路径前缀。

> 与开发环境的区别：开发时由 Vite 的代理完成路径前缀转发；生产环境改由 Nginx 完成，前端构建产物中的请求路径完全一致。

## 1. 端口与路径规划

| 组件 | 监听地址 | 对外暴露 | 说明 |
| --- | --- | --- | --- |
| Nginx | `0.0.0.0:80`（或 `443`） | 是 | 唯一对外入口 |
| Node.js 后端 | `127.0.0.1:3001` | 否 | 待办接口 |
| Spring Boot 后端 | `127.0.0.1:8080` | 否 | 分类接口 |

建议的服务器目录布局：

```
/opt/todo-app/
├── backend-node/          # Node.js 后端代码与依赖
│   ├── server.js
│   ├── package.json
│   ├── node_modules/
│   └── data/todos.json    # 运行期数据（需要备份）
├── backend-java/          # Spring Boot 运行目录
│   ├── todo-backend-java-1.0.0.jar
│   └── data/categories.json  # 运行期数据（需要备份）
└── frontend/dist/         # 前端构建产物（Nginx 静态根目录）
```

运行服务的系统用户建议使用专用的非 root 账号（下文以 `todoapp` 为例）：

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin todoapp
sudo mkdir -p /opt/todo-app
sudo chown -R todoapp:todoapp /opt/todo-app
```

## 2. 前置依赖

生产服务器需要具备：

| 组件 | 版本要求 | 用途 |
| --- | --- | --- |
| Node.js | 24.x | 构建前端、运行 Node.js 后端 |
| npm | 随 Node.js 安装（建议 11+） | 安装依赖、构建前端 |
| JDK | 21 | 运行 Spring Boot jar |
| Maven | 3.8+ | **仅构建阶段**需要，运行 jar 不需要 |
| Nginx | 任意稳定版本 | 静态文件与反向代理 |

检查版本：

```bash
node -v && npm -v
java -version
mvn -v          # 仅构建机需要
nginx -v
```

### 离线 / 内网 Nexus 环境

如果生产服务器无法访问公网，请先按 [README.md](./README.md) 的「离线 Nexus 配置参考」配置 `.npmrc` 与 `~/.m2/settings.xml`。

也可以在**联网的构建机上**完成构建，再把产物拷贝到生产服务器：

- 前端产物：`frontend/dist/`
- 后端 jar：`backend-java/target/todo-backend-java-1.0.0.jar`
- Node.js 运行时依赖：`backend-node/node_modules/`（或把 `package-lock.json` 一起带过去，在生产机执行 `npm ci --omit=dev`）

## 3. 构建

以下命令在项目根目录执行。

### 3.1 前端

```bash
cd frontend
npm ci
npm run build
# 产物位于 frontend/dist
```

### 3.2 Node.js 后端

```bash
cd backend-node
npm ci --omit=dev
# 本服务没有构建步骤，直接运行 server.js
```

> `express` 是唯一的生产依赖，安装体积很小。

### 3.3 Spring Boot 后端

```bash
cd backend-java
mvn -DskipTests clean package
# 产物位于 target/todo-backend-java-1.0.0.jar
```

如果构建机与生产机的 JDK 版本一致，jar 可以直接拷贝运行；无需在生产机安装 Maven。

## 4. 拷贝产物到服务器

下面两种方式任选其一。

### 方式 A：从构建机直接推到服务器（推荐）

```bash
# 在构建机（项目根目录）执行，DEPLOY_HOST 替换为实际主机
DEPLOY_HOST=deploy@192.0.2.10
APP=/opt/todo-app

# 先创建目标目录（若尚未创建）
ssh $DEPLOY_HOST "sudo install -d -o todoapp -g todoapp $APP/frontend $APP/backend-node $APP/backend-java"

# 前端静态文件
rsync -av --delete frontend/dist/ $DEPLOY_HOST:$APP/frontend/dist/

# Node.js 后端代码
rsync -av backend-node/server.js backend-node/package.json backend-node/package-lock.json \
  $DEPLOY_HOST:$APP/backend-node/

# Spring Boot jar
rsync -av backend-java/target/todo-backend-java-1.0.0.jar $DEPLOY_HOST:$APP/backend-java/
```

`node_modules/` 不建议跨机器同步（可能包含平台相关的二进制依赖）。推荐登录服务器后安装：

```bash
cd /opt/todo-app/backend-node
sudo -u todoapp npm ci --omit=dev
```

若服务器完全离线且无法访问 Nexus，则改为在构建机上打包依赖后传入：

```bash
# 构建机
tar -czf node-modules.tgz -C backend-node node_modules
scp node-modules.tgz $DEPLOY_HOST:/tmp/
# 服务器
sudo tar -xzf /tmp/node-modules.tgz -C /opt/todo-app/backend-node
sudo chown -R todoapp:todoapp /opt/todo-app/backend-node/node_modules
```

### 方式 B：产物先上传到服务器再本地部署

```bash
# 构建机
scp -r frontend/dist backend-node/server.js backend-node/package.json backend-node/package-lock.json \
  backend-java/target/todo-backend-java-1.0.0.jar $DEPLOY_HOST:/tmp/release/
```

```bash
# 服务器
sudo install -d -o todoapp -g todoapp /opt/todo-app/frontend/dist /opt/todo-app/backend-node /opt/todo-app/backend-java
sudo rsync -av /tmp/release/dist/ /opt/todo-app/frontend/dist/
sudo rsync -av /tmp/release/server.js /tmp/release/package.json /tmp/release/package-lock.json /opt/todo-app/backend-node/
sudo rsync -av /tmp/release/todo-backend-java-1.0.0.jar /opt/todo-app/backend-java/
```

### 修正属主与权限

```bash
sudo chown -R todoapp:todoapp /opt/todo-app
sudo find /opt/todo-app -type d -exec chmod 750 {} \;
sudo find /opt/todo-app -type f -exec chmod 640 {} \;
# 静态文件需对 Nginx 工作用户可读
sudo chmod -R a+rX /opt/todo-app/frontend/dist
```

## 5. 运行 Java 后端

### 5.1 验证启动参数

数据文件路径与端口都可以通过命令行参数覆盖（已验证）：

```bash
java -jar /opt/todo-app/backend-java/todo-backend-java-1.0.0.jar \
  --server.address=127.0.0.1 \
  --server.port=8080 \
  --app.data-file=/opt/todo-app/backend-java/data/categories.json
```

首次启动会自动创建 `data` 目录与 JSON 文件。启动完成后可访问 `http://127.0.0.1:8080/api/info` 检查。

### 5.2 systemd 服务

创建 `/etc/systemd/system/todo-java.service`：

```ini
[Unit]
Description=Todo Spring Boot backend
After=network.target

[Service]
Type=simple
User=todoapp
Group=todoapp
WorkingDirectory=/opt/todo-app/backend-java
ExecStart=/usr/bin/java -Xms128m -Xmx256m -jar /opt/todo-app/backend-java/todo-backend-java-1.0.0.jar --server.address=127.0.0.1 --server.port=8080 --app.data-file=/opt/todo-app/backend-java/data/categories.json
SuccessExitStatus=143
Restart=on-failure
RestartSec=5

# 基础加固：应用目录只读，仅数据目录可写
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadOnlyPaths=/opt/todo-app
ReadWritePaths=/opt/todo-app/backend-java/data

[Install]
WantedBy=multi-user.target
```

> `java` 的实际路径请用 `readlink -f $(which java)` 确认；若使用 SDKMAN 等方式安装，路径可能不在 `/usr/bin`。

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todo-java
sudo systemctl status todo-java
```

查看日志：

```bash
sudo journalctl -u todo-java -f
```

## 6. 运行 Node.js 后端

### 6.1 验证启动参数

Node.js 后端通过环境变量配置（已验证）：

```bash
HOST=127.0.0.1 \
PORT=3001 \
DATA_DIR=/opt/todo-app/backend-node/data \
node /opt/todo-app/backend-node/server.js
```

`HOST` 不设置时默认为 `0.0.0.0`（便于本地开发）；生产环境务必设置为 `127.0.0.1`。

启动完成后可访问 `http://127.0.0.1:3001/api/info` 检查。

### 6.2 systemd 服务

创建 `/etc/systemd/system/todo-node.service`：

```ini
[Unit]
Description=Todo Node.js backend
After=network.target

[Service]
Type=simple
User=todoapp
Group=todoapp
WorkingDirectory=/opt/todo-app/backend-node
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3001
Environment=DATA_DIR=/opt/todo-app/backend-node/data
ExecStart=/usr/bin/node /opt/todo-app/backend-node/server.js
Restart=on-failure
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadOnlyPaths=/opt/todo-app
ReadWritePaths=/opt/todo-app/backend-node/data

[Install]
WantedBy=multi-user.target
```

> `node` 的实际路径请用 `readlink -f $(which node)` 确认。

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todo-node
sudo systemctl status todo-node
sudo journalctl -u todo-node -f
```

## 7. 配置 Nginx

前端产物是纯静态文件，接口通过 Nginx 反向代理到两个后端。注意 **代理时需要去掉 `/api/node`、`/api/java` 前缀**，因为后端路由本身以 `/api/...` 开头。

创建 `/etc/nginx/conf.d/todo-app.conf`：

```nginx
server {
    listen 80;
    server_name todo.example.com;

    root /opt/todo-app/frontend/dist;
    index index.html;

    # 前端单页应用：找不到静态文件时回落到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 前端构建产物带 hash，可长期缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 反向代理：Node.js 后端（待办）
    location /api/node/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    # 反向代理：Spring Boot 后端（分类）
    location /api/java/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    client_max_body_size 1m;
}
```

关键点：

- `proxy_pass http://127.0.0.1:3001/;` 末尾的 `/` 表示**替换掉**匹配到的 location 前缀，即 `/api/node/api/todos` → `http://127.0.0.1:3001/api/todos`。漏掉这个斜杠会导致 404。
- `root` 指向的目录必须包含 `index.html` 和 `assets/`。
- 如果使用 HTTPS，请补充 `listen 443 ssl;`、证书路径，并把 80 端口配置为跳转到 443（可用 `certbot --nginx` 自动生成）。

检查并生效：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 7.1 Nginx 权限

Nginx 工作进程通常以 `nginx` 或 `www-data` 用户运行，需要能读取静态文件：

```bash
sudo chmod -R a+rX /opt/todo-app/frontend/dist
```

不要给整个 `/opt/todo-app` 目录 `a+r` 之外的写权限，数据目录应只对 `todoapp` 可写。

### 7.2 SELinux（CentOS / RHEL / Rocky）

若服务器启用了 SELinux，Nginx 反向代理默认会被拒绝。执行：

```bash
sudo setsebool -P httpd_can_network_connect 1
sudo semanage fcontext -a -t httpd_sys_content_t "/opt/todo-app/frontend/dist(/.*)?"
sudo restorecon -Rv /opt/todo-app/frontend/dist
```

## 8. 部署后验证

按顺序检查，任一步失败就先看对应服务的日志。

```bash
# 1) 两个后端进程是否存活
systemctl is-active todo-node todo-java

# 2) 后端本身是否正常（本机回环）
curl -s http://127.0.0.1:3001/api/info
curl -s http://127.0.0.1:8080/api/info

# 3) 经 Nginx 的接口链路
curl -s http://127.0.0.1/api/node/api/info
curl -s http://127.0.0.1/api/java/api/info

# 4) 前端页面
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/

# 5) 一次完整写入（验证持久化与权限）
curl -s -X POST http://127.0.0.1/api/java/api/categories \
  -H 'Content-Type: application/json' -d '{"name":"部署验证"}'
curl -s -X POST http://127.0.0.1/api/node/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"部署验证"}'

# 6) 数据文件已落盘
ls -l /opt/todo-app/backend-node/data/todos.json
ls -l /opt/todo-app/backend-java/data/categories.json
```

最后用浏览器访问 `http://todo.example.com`，页面顶部两张运行时信息卡片应分别显示 Node.js 与 Java/Spring Boot 的版本号；添加一条待办、一个分类，再刷新页面确认数据仍在。

验证完成后建议删除第 5 步产生的测试数据（在页面上点击「删除」即可）。

## 9. 数据备份与恢复

数据量很小，直接备份 JSON 文件即可。

```bash
sudo install -d -o todoapp -g todoapp /var/backups/todo-app
sudo -u todoapp tar -czf /var/backups/todo-app/todo-$(date +%F-%H%M).tgz \
  -C /opt/todo-app backend-node/data backend-java/data
```

建议加入 crontab（例如每天 3:00）：

```cron
0 3 * * * root /usr/bin/tar -czf /var/backups/todo-app/todo-$(date +\%F).tgz -C /opt/todo-app backend-node/data backend-java/data
```

恢复：先停止两个服务，用备份覆盖 `data/` 目录，确认属主为 `todoapp`，再启动服务。

> 两个 JSON 文件是各自服务**全量内存数据**的快照，写入时先写 `.tmp` 再 `rename`，因此单文件层面不会出现写到一半的损坏文件；但**跨服务没有事务**，备份时同时拷贝两个目录即可保证一致性。

## 10. 升级与回滚

### 升级步骤

```bash
# 1) 备份数据（见上一节）
# 2) 停服务
sudo systemctl stop todo-node todo-java

# 3) 替换产物
sudo rsync -av --delete frontend/dist/ /opt/todo-app/frontend/dist/
sudo rsync -av backend-node/server.js backend-node/package.json backend-node/package-lock.json /opt/todo-app/backend-node/
sudo rsync -av backend-java/target/todo-backend-java-1.0.0.jar /opt/todo-app/backend-java/
sudo chown -R todoapp:todoapp /opt/todo-app

# 4) 启动并验证
sudo systemctl start todo-node todo-java
curl -s http://127.0.0.1/api/node/api/info
curl -s http://127.0.0.1/api/java/api/info
```

只改前端时无需停后端，替换 `dist/` 后执行 `sudo systemctl reload nginx` 即可。

### 回滚

建议每次发版保留上一版产物：

```bash
# 发布时留一份旧版本
sudo cp /opt/todo-app/backend-java/todo-backend-java-1.0.0.jar \
        /opt/todo-app/backend-java/todo-backend-java-1.0.0.jar.bak
sudo cp -r /opt/todo-app/frontend/dist /opt/todo-app/frontend/dist.bak
```

回滚时停服务 → 用 `.bak` 覆盖 → 启动服务。数据文件格式向后兼容（只增加字段，不删除字段），通常无需回滚数据。

## 11. 安全与运维建议

- **不要用 root 运行**：两个后端都以 `todoapp` 系统用户运行，且只对 `data/` 目录有写权限。
- **不要暴露后端端口**：`3001`、`8080` 只监听 `127.0.0.1`；如使用云服务器，安全组只放行 80/443。
- **CORS 收紧**：当前两个后端为方便联调，允许任意来源（Node.js 使用 `Access-Control-Allow-Origin: *`，Spring Boot 使用 `allowedOriginPatterns("*")`）。同源部署后浏览器不会跨域，如需进一步收紧，可在 [server.js](./backend-node/server.js) 与 [WebConfig.java](./backend-java/src/main/java/com/example/todobackend/WebConfig.java) 中把允许来源改为生产域名。
- **前端说明**：本项目是演示性质的待办清单，**没有登录与权限控制**。若部署到公网且多人可访问，任何访问者都能增删数据；如需公开访问，建议在 Nginx 层加 Basic Auth 或限制来源 IP：

  ```nginx
  # 需要先创建密码文件：sudo htpasswd -c /etc/nginx/.htpasswd demo
  auth_basic "Restricted";
  auth_basic_user_file /etc/nginx/.htpasswd;
  ```

- **日志**：Java 用 `journalctl -u todo-java`，Node.js 用 `journalctl -u todo-node`，Nginx 用 `/var/log/nginx/access.log`、`error.log`。Node.js 后端只在内部错误时打印堆栈，正常请求不写日志。
- **内存**：Spring Boot 已限制 `-Xmx256m`，足够本应用；Node.js 默认堆即可。
- **健康检查**：两个服务都提供 `GET /api/info`，可用于监控探活（经 Nginx 访问为 `/api/node/api/info`、`/api/java/api/info`）。

## 12. 常见问题

| 现象 | 排查方向 |
| --- | --- |
| 页面 404 或空白 | `/opt/todo-app/frontend/dist` 是否存在 `index.html`；Nginx `root` 是否指对；查看 `error.log` |
| 接口返回 404 | 检查 `proxy_pass` 末尾是否带 `/`；请求路径是否为 `/api/node/...`、`/api/java/...` |
| 接口返回 502 | 对应后端未启动或端口不符：`systemctl status todo-node todo-java` |
| 页面提示「无法连接后端服务」 | 后端进程异常，或 Nginx 代理配置未 reload |
| Java 启动报 `Port 8080 was already in use` | 有别的进程占用端口：`ss -ltnp \| grep 8080` |
| 数据没保存 | `data` 目录属主/权限不对，或 systemd 的 `ReadWritePaths` 未包含该目录；`journalctl` 会有写文件失败日志 |
| SELinux 环境 502 | 执行第 7.2 节的两条命令 |
| 前端能打开但版本卡片显示「未连接」 | 两个 `/api/info` 代理链路中至少一条不通，逐个用 curl 验证 |
