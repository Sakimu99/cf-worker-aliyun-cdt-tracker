---
ai_level: low
---

# 阿里云CDT跟踪器与ECS控制（Cloudflare Worker）

该项目通过Cron Triggers在Cloudflare Workers上运行阿里云ECS控制逻辑。

它是原始`aly_ecs.py`脚本的无服务器替代方案。

## 先决条件

- 已安装[Node.js](https://nodejs.org/)
- Cloudflare账户。

## 设置

1. **安装依赖**

   ```bash
npm 安装
   ```

2. **配置机密**

   为了安全起见，请在Cloudflare中设置以下机密信息。不要将其提交到存储库中。

   ```bash
   npx wrangler secret put ACCESS_KEY_ID
   # 输入您的阿里云访问密钥ID

   npx wrangler secret put ACCESS_KEY_SECRET
   # 输入您的阿里云访问密钥Secret

   npx wrangler secret put REGION_ID
   # 输入您的区域ID（例如：cn-hongkong）

   npx wrangler secret put ECS_INSTANCE_ID
   # 输入您的ECS实例ID

   使用npx wrangler命令将TRAFFIC_THRESHOLD_GB作为机密保存
   # 输入阈值（例如：180）。若未设置，则默认为180。
   ```

3. **部署**

   ```bash
npx wrangler 部署
   ```

## 配置

- **计划**：默认情况下，工作进程每30分钟运行一次。您可以在`wrangler.toml`文件的`[triggers]`部分中进行修改。
  ```toml
  [触发器]
  crons = ["*/30 * * * *"]
  ```

## 开发

- **本地测试（通过HTTP触发）**

   在开发过程中，你可以通过访问工作进程URL来手动触发逻辑，例如在使用`wrangler dev`时。

  ```bash
  npx wrangler dev
  ```
