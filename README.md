# MuscleGo

面向 40–60 岁人群的每日低冲击力量训练微信小程序。采用原生 WXML / WXSS / JavaScript，无第三方运行时依赖。

## 已实现

- 今日训练、一周计划与动作安全指导
- 标准训练与 3 分钟轻量训练
- 动作计时、暂停、切换、中断续练和提前保存
- 每周 4 天目标、轻量/完整打卡、月历与实际训练时长统计
- 提醒时间偏好与微信订阅消息授权入口
- 微信原生打卡分享与好友邀请
- 不限人数的熟人锻炼搭子：邀请确认、周进度、每日鼓励和解除关系
- 未训练时每日一次一起练邀请，可回应「去练 3 分钟」或「今天休息」，首页显示待回应邀请
- 用户明确授权后才同步训练记录，普通训练默认仅保存在本机
- 会员套餐、续费规则披露、服务端下单及微信支付调用

## 运行

1. 用微信开发者工具导入本目录。
2. 在 `project.config.json` 中将 `appid` 替换为自己的小程序 AppID。
3. 编译后即可体验训练、计时、轻量训练、续练和本机打卡。
4. 好友搭子需要启动本地服务端，见下一节。

## 本地联调锻炼搭子

服务端零第三方依赖，使用 Node.js 18+：

```bash
cd server
npm start
```

然后：

1. 将 `config.js` 的 `apiBaseUrl` 改为 `http://127.0.0.1:3000`。
2. 微信开发者工具 → 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
3. 在小程序「我的 → 锻炼搭子」中同意开启，随后可分享邀请码给另一个开发账号验证。
4. 本地数据保存在 `server/data/musclego.json`，该目录已被 `.gitignore` 排除。

运行服务端测试：

```bash
cd server
npm test
```

本地服务端默认使用设备标识模拟登录，仅用于开发。部署时必须配置 `WX_APPID`、`WX_SECRET` 并设置 `ALLOW_DEV_LOGIN=false`，同时使用 HTTPS、正式数据库、限流和备份。仓库内文件存储实现不应用于正式环境。

微信支付和订阅消息尚未在本地服务端实现，因为它们必须配置商户号、支付证书、订阅模板和定时发送任务。这两部分仍按下方接口接入正式服务。

## 正式上线前配置

在 `config.js` 配置 `apiBaseUrl` 与 `subscribeTemplateIds`，并在小程序后台配置合法请求域名。

- `POST /auth/login`：接收 `wx.login` 的 `code`，服务端调用微信接口换取 OpenID 并返回 `token`。小程序密钥不得放在客户端。
- `POST /records/complete`：接收 `sessionId`、`clientDate`、`dayIndex`、`mode`、`durationSeconds`、`completedExercises`、`full`。以 `sessionId` 做幂等处理；`clientDate` 仅允许本周日期，用于首次开启搭子时补同步。
- `POST /partners/overview`：返回 `inviteCode`、`me`、全部 `partners` 和待回应的 `incomingNudges`。伙伴数据只包含 `id`、`nickname`、`weekCount`、`todayCompleted`、`cheeredToday`、`nudgedToday`、`nudgeStatus`。
- `POST /partners/accept`：接收 `inviteCode`；服务端校验邀请有效期并禁止添加自己，不限制参与人数。
- `POST /partners/cheer`：接收 `partnerId`；服务端校验双方关系和每日一次限制，不返回伙伴的敏感训练数据。
- `POST /partners/nudge`：接收 `partnerId`、`type`，每对搭子每天最多发送一次一起练邀请。当前为站内邀请，用户打开小程序后可见；外部微信提醒需另接订阅消息。
- `POST /partners/nudge/respond`：接收 `nudgeId`、`status`；仅接收方可以回应 `training` 或 `rest`，且只能回应一次。
- `POST /partners/remove`：接收 `partnerId`，解除双方关系并立即停止共享。
- `POST /profile/nickname`：接收 `nickname`，仅用于向搭子展示，限制 2–12 个字符。
- `POST /payments/membership`：接收 `productId`、`autoRenew`，服务端鉴权并创建订单，返回 `timeStamp`、`nonceStr`、`package`、`signType`、`paySign`。密钥、签名和真实金额校验必须放在服务端。
- `POST /reminders/schedule`：接收 `time`、`enabled`，由服务端按订阅授权调度或关闭微信通知。小程序不能自行创建可靠的每日后台闹钟。
- 连续包季需接入微信支付签约/委托代扣能力，由服务端按签约协议发起周期扣款并处理回调、退款和关闭续费。客户端不会也不应直接扣款。
- 支付成功后应由服务端核验支付回调并下发会员权益；当前客户端会员展示仅用于原型联调。
- 上线前补充用户登录、服务端记录同步、隐私协议、客服与真实内容审核。

> 训练内容仅用于产品演示，不构成医疗建议。正式内容应由专业人员审核。
