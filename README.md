---
ai_level: low
---

# 阿里云 CDT 流量跟踪与 ECS 控制（Cloudflare Worker）

本项目通过 Cloudflare Worker 的定时触发器运行阿里云 ECS 控制逻辑。

它是原始脚本 `aly_ecs.py` 的无服务器替代方案。

## 前提条件

- 已安装 [Node.js](https://nodejs.org/)
- 拥有 Cloudflare 账号。

## 设置步骤

1. **安装依赖**

   ```bash
   npm install
   ```

2. **配置密钥**

   为保证安全，请在 Cloudflare 中设置以下密钥。切勿将其提交到代码仓库中。

   ```bash
   npx wrangler secret put ACCESS_KEY_ID
   # 输入你的阿里云 Access Key ID

   npx wrangler secret put ACCESS_KEY_SECRET
   # 输入你的阿里云 Access Key Secret

   npx wrangler secret put REGION_ID
   # 输入你的地域 ID（例如：cn-hongkong）

   npx wrangler secret put ECS_INSTANCE_ID
   # 输入你的 ECS 实例 ID

   npx wrangler secret put TRAFFIC_THRESHOLD_GB
   # 输入流量阈值（例如：180）。如不设置，默认值为 180。
   ```

3. **部署**

   ```bash
   npx wrangler deploy
   ```

## 配置说明

- **定时规则**: 默认情况下，Worker 每 30 分钟运行一次。你可以在`wrangler.toml`文件的`[triggers]`部分修改此设置。
  ```toml
  [triggers]
  crons = ["*/30 * * * *"]
  ```

## 开发调试

- **本地测试（通过 HTTP 触发）**

   开发期间，你可以通过访问 Worker 的 URL 手动触发逻辑例如在使用`wrangler dev`时

  ```bash
  npx wrangler dev
  ```
