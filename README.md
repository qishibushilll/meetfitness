# MeetFitness

微信小程序健身和饮食记录 MVP，使用腾讯云开发保存动作库、训练记录和饮食记录。

## 云开发数据集合

在微信开发者工具中开通云开发后，创建这些数据库集合：

- `exercises`: 动作库，来自 `yuhonas/free-exercise-db`
- `workouts`: 用户训练记录
- `meals`: 用户饮食记录
- `users`: 用户资料和角色

建议权限：

- `exercises`: 所有人可读，仅管理员可写
- `workouts`: 仅创建者可读写
- `meals`: 仅创建者可读写
- `users`: 仅创建者可读写；管理员维护建议通过云函数

## 导入动作库

1. 在微信开发者工具中右键 `cloudfunctions/importExercises`，选择上传并部署。
2. 右键 `cloudfunctions/exerciseApi`，选择上传并部署。
3. 右键 `cloudfunctions/userApi`，选择上传并部署。
4. 打开云开发控制台，测试运行 `importExercises`。
5. 首次调试可以传入：

```json
{
  "limit": 5,
  "offset": 0,
  "uploadImages": false
}
```

默认会从云函数内置的 10 条 seed 动作导入，不访问 GitHub，避免云函数测试页 3 秒超时。
seed 动作会同时写入中文字段，例如 `nameZh`、`muscleZh`、`equipmentZh`，页面会优先显示中文。已导入过英文数据时，重新运行 `importExercises` 会更新同一批记录并补齐中文字段。

确认正常后，如果要尝试远程完整数据，可以传：

```json
{
  "limit": 5,
  "offset": 0,
  "uploadImages": false,
  "useRemote": true
}
```

开发阶段先不要上传图片，使用 `uploadImages: false` 写入 GitHub 原图 URL。微信开发者工具里需要关闭合法域名校验，或者在详情/本地设置里勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。

生产环境建议再把动作图片上传到云存储，避免小程序线上环境受 GitHub 图片域名限制：

```json
{
  "limit": 10,
  "offset": 0,
  "uploadImages": true
}
```

云函数测试页常见 3 秒超时，不适合直接用 `uploadImages: true` 从 GitHub 下载并上传图片。如果需要云存储图片，后续应使用本地脚本或更长超时的云端执行入口批量上传。`exerciseApi` 已支持把云存储 `fileID` 转成临时 URL 返回给小程序页面展示。

如果云函数测试页显示 `Invoking task timed out after 3 seconds`，请改用 `uploadImages: false`。这一步不会下载图片，只导入动作数据和图片 URL。

如果远程模式仍然 3 秒超时，就先使用默认 seed 模式；完整动作库可以后续通过本地脚本或云函数更长超时配置导入。

## 完整动作库导入

完整导入不要使用云函数运行时访问 GitHub，容易被 3 秒测试超时卡住。推荐做法：

1. 下载 `yuhonas/free-exercise-db` 的 `dist/exercises.json`
2. 放到 `cloudfunctions/importExercises/data/exercises.json`
3. 重新部署 `cloudfunctions/importExercises`
4. 分批运行：

```json
{
  "limit": 5,
  "offset": 0,
  "uploadImages": false
}
```

然后依次改 `offset` 为 `5`、`10`、`15`，直到返回的 `imported` 小于 `limit`。微信云函数测试入口通常只有 3 秒，完整导入时不要一次导 50 条；先用 `limit: 5`，稳定后再尝试 `limit: 10`。如果 `data/exercises.json` 不存在或文件损坏，云函数会自动回退到内置 seed 动作，返回里的 `mode` 会显示 `seed`；完整文件生效时 `mode` 会显示 `local`。

如果页面能看到动作名称但图片是灰色，说明动作数据已经导入成功，但图片 URL 加载失败。先确认已经重新部署 `importExercises` 并用下面参数刷新过图片 URL：

```json
{
  "limit": 10,
  "offset": 0,
  "uploadImages": false
}
```

然后在开发者工具里关闭合法域名校验并重新编译。如果仍然灰色，再检查数据库里的 `imageUrl` 是否为 `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg` 这种带大写和下划线的路径。

如果动作选择页提示动作库为空，说明小程序没有从云端拿到 `exercises` 数据。先确认：

- `exerciseApi` 已上传并部署
- `importExercises` 已成功运行
- 云数据库 `exercises` 集合里有数据
- 使用 `uploadImages: true` 导入时，云存储里出现了 `exercise-images/` 目录

导入前页面不会再显示本地默认动作图，以免把应用图标误认为真实动作图片。

如果云开发控制台弹出白页并显示 `something wrong with request handler`，通常是开发者工具内置控制台页面异常。可以先关闭这个弹窗，仍然在左侧文件树里右键云函数文件夹部署；之后升级或重启微信开发者工具，再从顶部 `云开发` 入口进入控制台测试云函数。

动作数据源：

- <https://github.com/yuhonas/free-exercise-db>

## 小程序页面

- 今日：当天训练和饮食汇总
- 训练：点击动作图片选择动作，记录组数、次数、重量
- 饮食：记录餐次、食物、热量和蛋白质
- 历史：按日期查看汇总
- 我的：普通用户入口和管理员入口

## 用户角色

用户登录和注册通过 `cloudfunctions/userApi` 完成。首次进入“我的”页时，云函数会用微信 openid 自动创建 `users` 记录，默认：

```json
{
  "registered": false,
  "role": "user"
}
```

用户填写昵称后，`registered` 会变为 `true`。
头像通过“我的”页的微信头像选择能力获取，并上传到云存储 `user-avatars/` 目录；`users` 记录会保存 `avatarFileId` 和 `avatarUrl`。

要让某个账号看到管理员入口，在云开发数据库 `users` 集合中把该用户记录改成：

```json
{
  "role": "admin"
}
```

当前版本先做页面入口控制。生产环境还需要把管理员写操作放到云函数里，并在云函数中校验 `users.role === "admin"`，避免普通用户绕过前端直接改数据库。
