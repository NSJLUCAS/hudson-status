# hudson-status
一款优雅的 NodeGet 前端公开状态监控页。支持全球 2D 地图、服务器在线状态、CPU / 内存 / 磁盘 / 网络监控、流量统计、成本与到期时间展示等功能。纯静态构建，并可一键部署到 Cloudflare Pages、EdgeOne Pages 等静态托管平台。

## 环境要求

- **Node.js** 18+（推荐LTS）
- **npm** 9+（下文以 npm 为例）

## 配置 `public/config.json`

前端启动后请求 **`/config.json`**（开发与生产均为站点根路径）。构建时 **`public/config.json`** 会复制到 **`dist/config.json`**。

| 字段 | 类型 | 说明 |
|------|------|------|
| `site_name` | 字符串 | 浏览器标题与页头展示名称 |
| `site_logo` | 字符串 | 页头 Logo URL（可为相对路径如 `/favicon.svg`，也可为空） |
| `footer` | 字符串 | 页脚文案 |
| `site_tokens` | 数组 | 多条后端连接；每项见下表 |

`site_tokens` 每一项：

| 字段 | 说明 |
|------|------|
| `name` | 展示名称（如「master-1」） |
| `backend_url` | NodeGet WebSocket 地址，一般为 `wss://你的域名/...` |
| `token` | Dashboard创建的 Visitor 权限 token |

示例：

```json
{
  "site_name": "Hudson Status",
  "site_logo": "/logo.svg",
  "footer": "Powered by NodeGet",
  "site_tokens": [
    {
      "name": "master server node 1",
      "backend_url": "wss://your-backend.example.com",
      "token": "YOUR_TOKEN_HERE"
    }
  ]
}
```

修改配置后需重新构建或同步 `dist/config.json`。

## 构建部署（任意静态托管）

不依赖云平台时，按下面步骤即可得到可上线的静态文件：

1. **获取代码**：
    ```bash
    git clone https://github.com/hudsonsir/hudsonsir-finance-panel.git
    cd finance-panel
    ```
     或下载源码压缩包并解压。
5. **编辑配置**：修改 **`public/config.json`**（站点名、Logo、`site_tokens` 等）。
6. **安装依赖**：在项目根目录执行 `npm install`。
7. **编译打包**：执行 `npm run build`，打包输出到文件夹 **`dist/`**。
8. **部署**：将 **`dist/` 目录内全部文件**上传到站点根目录（或静态托管根路径）。
9. **访问**：用浏览器打开你的域名；若站。
10. **修改**：后续修改可以编辑config.json

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run build` | 打包 `dist/` |

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hudsonsir/hudson-Status)

点击按钮可在 Cloudflare 中从 [hudsonsir/hudson-Status](https://github.com/hudsonsir/hudson-Status) 发起一键部署；使用自己的 Fork 时，把链接里的 GitHub 仓库 URL 换成你的仓库。

**推荐流程：** Fork → 编辑配置 **`public/config.json`**。

详细教程查看：[https://nodeget.com/guide/install/status-show.html](https://nodeget.com/guide/install/status-show.html)

### 其他托管与资源

从[Issues](../../releases)下载以打包好的ZIP文件 解压编辑/config.json 上传到任意静态托管平台 如腾讯云EdgeOne Pages等

## 自定义 CSS（`src/index.css`）

全局样式与主题入口为 **`src/index.css`**。修改该文件即可调整整体观感，无需逐个组件改 class：

- **Tailwind CSS v4**：`@import "tailwindcss"` 与 `@theme inline` 将自定义变量接到工具类。
- **语义色**：在 `:root` 与 `html.dark` 中定义 **OKLCH** 变量（如 `--app-background`、`--app-primary` 等），亮色 / 暗色切换会一并生效。
- **图表色**：`--app-chart-1` … `--app-chart-5` 供 Recharts 序列使用。
- **动画与纹理**：文件末尾含 `fade-in`、`pulse-ring`、`scanline` 等 keyframes 与 `.animate-*`、`.bg-grid-pattern`，可直接在组件中使用。

更细的变量说明见 **`src/index.css` 顶部注释块**。下列为常用变量速查：

| 变量 | 用途 |
|--------|------|
| `--app-background` / `--app-foreground` | 页面背景与主文字 |
| `--app-card*`、`--app-popover*` | 卡片与浮层 |
| `--app-primary*`、`--app-accent*` | 主色与强调 |
| `--app-muted*`、`--app-border`、`--app-ring` | 辅助色与边框、焦点环 |
| `--app-sidebar-*` | 侧栏配色 |
| `--app-chart-1` … `--app-chart-5` | 图表序列色 |

## 致谢

- 后端与生态：**[NodeGet](https://github.com/NodeSeekDev/NodeGet)**
- 前端参考：**[NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow)**
- 开源项目：**React**、**Vite**、**Tailwind CSS**、**shadcn/ui**、**React Router**、**TanStack Query**、**Recharts**、**d3-geo** 及各自社区与文档维护者
