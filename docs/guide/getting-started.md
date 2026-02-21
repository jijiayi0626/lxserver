# 快速开始

本项目是一个增强版的 LX Music 数据同步服务端，同时内置了一个强大的 Web 播‏‏放器。使用本服务，您可以同时实现歌曲数据的同步和直接在线播放。

## 部署说明

我们推荐使用 Docker 部署以获得最稳定的体验。

### 方式一：使用 Docker (推荐)

运行如下命令，将会启动在主机的 `9527` 端口：

```bash
docker run -d \
  -p 9527:9527 \
  -v $(pwd)/data:/server/data \
  -v $(pwd)/logs:/server/logs \
  --name lx-sync-server \
  --restart unless-stopped \
  ghcr.io/xcq0607/lxserver:latest
```

### 方式二：直接运行 (Git Clone)

确保您的环境 Node.js 版本 `>= 16`。

```bash
# 1. 克隆项目
git clone https://github.com/XCQ0607/lxserver.git && cd lxserver

# 2. 安装依赖并编译
npm ci && npm run build

# 3. 启动服务
npm start
```

## 访问服务

启动成功后，您可以通过浏览器访问服务地址。

| 服务组件 | 访问地址 | 默认验证方式 |
| -------- | -------- | ------------ |
| **同步管理后台** | `http://{IP}:9527` | 默认密码: `123456` |
| **Web播放器** | `http://{IP}:9527/music` | 可选（取决于配置）|

## 如何进行设置修改

服务大部分设置都可以通过同步服务器的**WebDAV 同步**与**系统设置**界面在线更改。修改配置后，它会自动生效或提示您相关操作。

如果需要通过系统环境变量去设置初始化参数（例如在Docker环境下），请参考 GitHub README 或者参考[同步服务器向导](./sync-server.md#初始化配置)。
