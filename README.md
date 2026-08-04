# koishi-plugin-baha-update-listener

巴哈姆特动画疯更新监听 Koishi 插件。由原 `baha-update-listener` Telegram Bot 重写而来，查询和推送均使用 Koishi 的跨平台消息接口。

## 功能

- 定时轮询动画疯首页 API，监听公告和 ON AIR 条目变化。
- 首次启动仅建立状态基线，不推送现有历史内容。
- 将更新推送到多个平台、机器人和频道。
- 查询当前公告、每周更新排程和指定影片详情。
- 状态写入 `data/baha-update-listener/state.json`，重启后仍可精确比较更新。
- 支持移动端请求头和自定义 Web User-Agent。

## 环境要求

- Node.js 20 或更高版本
- Koishi 4.18.11 或兼容版本

## 安装与构建

```powershell
npm install
npm run build
```

在 Koishi 应用目录中安装本地插件包：

```powershell
npm install D:\Codes\baha-update-listener-koishi
```

也可以将本仓库放入 Koishi 工作区的 `plugins` 目录后，通过控制台启用。

## 配置

核心配置如下：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `targets` | `[]` | 主动推送目标；留空时只启用查询指令 |
| `pollIntervalSeconds` | `60` | 轮询间隔，最小 15 秒 |
| `timezone` | `Asia/Taipei` | IANA 时区名 |
| `useMobileApi` | `true` | 是否使用动画疯 Android 请求头 |
| `webUserAgent` | Chrome UA | Web 请求头模式使用的 User-Agent |
| `requestTimeoutSeconds` | `20` | API 请求超时秒数 |
| `maxPushItems` | `12` | 单次 ON AIR 通知条目上限 |
| `maxScheduleItems` | `30` | 单日排程显示上限 |

每个 `targets` 条目包含：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `platform` | 是 | Koishi 平台名，例如 `telegram`、`discord`、`onebot` |
| `channelId` | 是 | 频道、群组或私聊 ID |
| `selfId` | 否 | 指定机器人账号；留空时使用该平台第一个机器人 |
| `guildId` | 否 | 某些平台发送频道消息所需的服务器 ID |

示例配置：

```yaml
targets:
  - platform: telegram
    selfId: "123456789"
    channelId: "-1001234567890"
  - platform: discord
    channelId: "123456789012345678"
    guildId: "987654321098765432"
pollIntervalSeconds: 60
timezone: Asia/Taipei
useMobileApi: true
```

## 指令

| 指令 | 说明 |
| --- | --- |
| `baha` | 显示插件指令帮助 |
| `baha.announcement` | 查看当前公告，别名 `announcement` |
| `baha.schedule [星期]` | 查看更新排程，别名 `schedule` |
| `baha.anime <sn>` | 查询影片详情，别名 `anime` |

排程星期参数支持 `1-7`、`mon-sun`、`周一-周日`、`週一-週日` 和 `星期一-星期日`。省略参数时使用配置时区中的当天。

## 开发检查

```powershell
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

