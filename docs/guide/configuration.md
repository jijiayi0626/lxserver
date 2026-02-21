# 配置文件及环境变量

本项目拥有非常灵活的配置注入机制。
后端服务器在被启动时（`node index.js`），将会按一定**优先级**顺序加载所需配置。

## 先决理解

LX Music Sync Server 内部维护了一个统一的配置模型，它的默认值定义于 `src/defaultConfig.ts` 中。当服务器运行时，这些配置会被解析，并同时供给于：

1. **服务端环境**：控制诸如 `port` (端口), `bindIP` (绑定IP), `webdav.url` (WebDAV链接) 等。
2. **Web 前端环境**（位于 `public/`）：当浏览器访问页面时，服务端会动态生成 `/js/config.js` 并在 `window.CONFIG` 中注入必要的前端配置项（过滤掉了密码等关键数据）。这也是为什么前端不包含写死的编译配置。

## 加载优先级

参数设置遵循以下优先级规则（由高到低，高优先级将**覆盖**低优先级的相同设置）：

1. **System ENV（系统环境变量）** 例如：`PORT=9527`、`DISABLE_TELEMETRY=true`。
2. **自定义配置文件（如果有指定）** 例如通过指定环境变量 `CONFIG_PATH=/data/my-config.json` 加载的 JSON 文件。
3. **根目录的 `config.js`**：通过传统 JS Node `require` 加载的对象。
4. **内部默认缺省配置**：即 `src/defaultConfig.ts` 定义的值。

## 详细参数说明

### 核心参数

| 环境变量参数          | `defaultConfig.ts` 对应键值 | 类型    | 默认值        | 说明                                                                 |
| --------------------- | ----------------------------- | ------- | ------------- | -------------------------------------------------------------------- |
| `PORT`              | `port`                      | number  | `9527`      | 同步服务监听端口                                                     |
| `BIND_IP`           | `bindIP`                    | string  | `0.0.0.0`   | 绑定的IP层（可用来限制局域网或对外网）                               |
| `PROXY_HEADER`      | `proxy.header`              | string  | `x-real-ip` | 使用反向代理（如Nginx）时，指定解析真实IP的标头                      |
| `DISABLE_TELEMETRY` | `disableTelemetry`          | boolean | `false`     | 关闭后不再汇报匿名统计，同时将不会通过接口收到系统的通知与更新提示。 |

### 管理与同步

| 环境变量参数          | `defaultConfig.ts` 对应键值 | 类型    | 默认值     | 说明                                           |
| --------------------- | ----------------------------- | ------- | ---------- | ---------------------------------------------- |
| `FRONTEND_PASSWORD` | `frontend.password`         | string  | `123456` | 访问 Web 同步管理控制台 (`/`) 使用的登录密码 |
| `MAX_SNAPSHOT_NUM`  | `maxSnapshotNum`            | number  | `10`     | 系统内允许自动保留的最大歌单备份快照数上限。   |
| `USER_ENABLE_PATH`  | `user.enablePath`           | boolean | `true`   | 是否启用按用户划分子路径存储（支持多用户分层） |
| `USER_ENABLE_ROOT`  | `user.enableRoot`           | boolean | `false`  | 是否开启根路径写入                             |

### WebDAV 同步备份设置

| 环境变量参数        | `defaultConfig.ts` 对应键值 | 类型   | 默认值 | 说明                                           |
| ------------------- | ----------------------------- | ------ | ------ | ---------------------------------------------- |
| `WEBDAV_URL`      | `webdav.url`                | string | `''` | 你的远程或者挂载的 WebDAV 地址。               |
| `WEBDAV_USERNAME` | `webdav.username`           | string | `''` | WebDAV 登录用的用户名                          |
| `WEBDAV_PASSWORD` | `webdav.password`           | string | `''` | WebDAV 登录的独立应用级别/账号密码             |
| `SYNC_INTERVAL`   | `sync.interval`             | number | `60` | 自动执行 WebDAV 备份上传的间隔。单位为：分钟。 |

> 如果启动服务器时，配置内有合法的 WebDAV 信息，服务端会自动在加载本地磁盘前，**尝试优先从远程 WebDAV 下载最新的快照并恢复**，覆盖到本地后再启动同步循环体。因此，通过配置 WebDAV 更可以作为跨主机迁移！

### Web 播放器控制

| 环境变量参数              | `defaultConfig.ts` 对应键值 | 类型    | 默认值     | 说明                                                                                       |
| ------------------------- | ----------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------ |
| `ENABLE_WEBPLAYER_AUTH` | `player.enableAuth`         | boolean | `false`  | 决定是否为 WebPlayer（`/music`）页面设置进入拦截。如果开启，每次回话访问必须先输入密码。 |
| `WEBPLAYER_PASSWORD`    | `player.password`           | string  | `123456` | 设置Web播放器（`/music`）界面的准入验证密码。                                            |

### 用户配置初始化

除了通过 Web 界面创建同步账号外。您同样支持环境变量初始导入。
通过设定 `LX_USER_<用户名>` = `密码` 可以在启动时自动将用户写入。

#### 示例

```bash
# 这将会创建两个准入的设备端用户名为 foo 和 bar，密码为对应值
export LX_USER_foo="mypassword123"
export LX_USER_bar="mypassword321"
node index.js
```

另外，运行时发生的所有用户变动以及新增，都最终会被热持久化在 `<DATA_PATH>/users.json` 文件内。

---

如果使用 Docker 安装，建议将此篇文档中提及的关键**环境变量参数**直接填入 Docker-Compose 文件或 `docker run -e` 命令之中以达到灵活配置的效果！
