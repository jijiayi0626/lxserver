# 服务端 API 参考

LX Sync Server 提供了多种 RESTful 风格的 API 接口，用于自动化获取和操控同步服务器数据以及状态。

## 概述
为了确保安全性，部分 API 要求使用管理终端的全局口令或请求体本身存在的设备口令密码进行签名鉴权。
所有接口如无特殊说明均**使用 JSON 作为请求体及响应体**类型 (`Content-Type: application/json`)。

如果您基于自身需求定制了一个客户端管理控制台功能，或是想在其它服务内利用数据并开发插件程序，请参考以下规范。

---

## 控制台管理员系列 API
以下系列 API 基本都需要传入一个 Header 进行管理权验证：
- `x-frontend-auth`: 为你在 `defaultConfig.ts` 或环境变量里设定的 `frontend.password`（默认为 `123456`）。

### 1. 服务状态 (/api/status)

获取同步服务器整体内存消耗、设备在线情况、运行时间汇总状态。

- **URL:** `/api/status`
- **Method:** `GET`
- **Header Auth:** 要求必须传入 `x-frontend-auth: <Admin Password>`

**成功响应 (200 OK):**
```json
{
  "users": 2, // 系统已注册的用户个数
  "devices": 1, // 当前正通过 WebSocket 同步在线连接的设备数量
  "uptime": 12435.5, // 节点运行持续秒数
  "memory": 45367823 // RSS 当前内存占用字节数
}
```

### 2. 账号体系概览 (/api/users)

用以读写 `users.json` 文件里的配置。

#### `GET /api/users`
展示当前所有存在于系统的独立设备端账号与密码（**要求 Admin Auth 标头**）。

**成功响应 (200 OK):**
```json
[
  { "name": "user1", "password": "123" },
  { "name": "user2", "password": "321" }
]
```

#### `POST /api/users`
快速添加一个设备同步注册用户（**要求 Admin Auth 标头**）。

**请求 Body:**
```json
{
  "name": "newuser",
  "password": "newpassword"
}
```

#### `DELETE /api/users`
撤除某些同步设备账户及其备份信息（**要求 Admin Auth 标头**）。

**请求 Body:**
```json
{
  "names": ["newuser"], // 接受批量用户名数组
  "deleteData": true // 是否一并清理其用户专有的备份数据以及数据库历史文件
}
```

### 3. 数据层获取 (/api/data)

针对某些用户的数据和列表信息进行审查获取。

#### 3.1 获取对应用户实时歌单状态 `/api/data`
**URL 参数**: `?user={username}`
**要求 Auth**: `x-frontend-auth` 验证身份后返回当前用户所有的源数据 JSON Array。

#### 3.2 历史快照节点列表 `/api/data/snapshots`
**URL 参数**: `?user={username}`
**说明**: 获取用户的同步歌单历史快照信息记录点。

#### 3.3 拉取单个快照 `/api/data/snapshot`
**URL 参数**: `?user={username}&id={snapshot_id}`
**说明**: 传入 Snapshot ID，向服务器索要那个时点上的完整快照数据（非直接恢复应用，仅为只读获取）。

#### 3.4 下发快照恢复 `/api/data/restore-snapshot`
**请求 Method**: `POST`
**URL 参数**: `?user={username}`
**请求 Body**: `{"id": "snapshot_id"}`
**说明**: 指令服务端主动抹除该用户列表并将数据回退覆盖到制定的 Snapshot 节点上。

---

## 用户态 API 系列 (常规客户端联动 API)

以下 API 多数服务于 Web 播放器或其他具有单独同步名下业务层账号能力的客户端。它们不再需要 `x-frontend-auth` 而是要求：
- `x-user-name`: 同步账号名称
- `x-user-password`: 同步账号密码匹配

### 批量剔除指定列表歌曲 (/api/music/user/list/remove)
这是从同步列表主动执行单删除流接口。

- **URL:** `/api/music/user/list/remove`
- **Method:** `POST`
- **Required Header:** `x-user-name` & `x-user-password`

**请求 Body:**
```json
{
  "listId": "default", // 您在此用户的名下期望操作的指定歌单 ID 或者是 "default" (我的收藏)
  "songIds": [ // 欲被排除的歌曲ID
    "kg_xxxx",
    "kw_yyyy"
  ]
}
```

> 此操作将导致服务器侧发出同步热更新通知。连接在同一名下 `x-user-name` 的其它客户端也将因 Sync Update 从自身的列表中排除这些失效歌曲。

---

## Web Player 核心音乐 API 系列

主要用于提供在线播放器的数据支持，聚合了原版内嵌的各大音乐平台。注意：在安全配置下，它可能依赖 Cookie (`lx_player_session`) 的持久拦截或基于设置的免签。

### 1. 获取基础配置 `GET /api/music/config`
返回当前服务端的全局 Web 播放器配置总览，如是否开启了 `player.enableAuth` 防火墙防护机制。任何访问者皆可只读获取。

### 2. 身份验证流程
只有当系统启用了 `player.enableAuth` 时，才要求请求持有 Session Cookie 才能放行如下核心音乐请求。
* `POST /api/music/auth`: 校验密码 (`{"password": "密码"}`) 并获取长期有效的 HTTP Only Session Token Cookie。
* `GET /api/music/auth/verify`: 仅查询目前自身浏览器下，基于 Token 是否存活。
* `POST /api/music/auth/logout`: 主动抛弃注销自身的当前 Session。

### 3. 多源聚合音乐搜索 `/api/music/search`

进行大类检索。

- **Method:** `GET`
- **URL Query Parameters:**
  - `name`: `(Required)` 搜索关键字
  - `source`: 指定源，如 `kw` `kg` `tx` `wy` 等
  - `limit`: 返回数量 (默认20)
  - `page`: 分页 (默认1)

**响应内容:** 基于不同的源返回 JSON 对象聚合体。

### 4. 获取音乐播放直链 `/api/music/url`

将 `songInfo` 的数据交由目标处理后产生媒体数据物理链接。该接囗支持被自定义源脚本接管扩展。

- **URL:** `/api/music/url`
- **Method:** `POST`

**请求 Body:**
```json
{
  "quality": "128k", // 或 320k, flac
  "songInfo": {
    "source": "kw",
    "songmid": "xxxx"
    // 以及搜索结果里带出来的其余信息等
  }
}
```

### 5. 获取音乐歌词信息 `/api/music/lyric`

同播放直链相同参数，入参与上一条完全一致。由 `musicSdk` 将歌曲剥离成原生文本并带有基于事件轴 `\n[00:xxx]` 的动效字符串体 JSON 返回。

### 6. 获取各类热搜信息 `/api/music/hotSearch`

获取各家平台实时热门搜索词条列表。支持 URL 参数 `source`。
支持设置缓存（Cache-Control : 300s）。

### 7. 获取歌曲精选评论 `/api/music/comment`

- **URL:** `/api/music/comment`
- **Method:** `POST`

**请求 Body:**
```json
{
  "songInfo": { "source": "tx", "songmid": "xxxx" },
  "type": "hot",  // hot 获取热评， 非hot时获取新评
  "page": 1,
  "limit": 20
}
```
