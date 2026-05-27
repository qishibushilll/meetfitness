# MeetFitness

微信小程序健身和饮食记录 MVP，使用腾讯云开发保存动作库、训练记录和饮食记录。

## 云开发数据集合

在微信开发者工具中开通云开发后，创建这些数据库集合：

- `exercises`: 动作库，来自 `yuhonas/free-exercise-db`
- `workouts`: 用户训练记录
- `meals`: 用户饮食记录

建议权限：

- `exercises`: 所有人可读，仅管理员可写
- `workouts`: 仅创建者可读写
- `meals`: 仅创建者可读写

## 导入动作库

1. 在微信开发者工具中右键 `cloudfunctions/importExercises`，选择上传并部署。
2. 右键 `cloudfunctions/exerciseApi`，选择上传并部署。
3. 打开云开发控制台，测试运行 `importExercises`。
4. 首次调试可以传入：

```json
{
  "limit": 50
}
```

确认正常后再不传 `limit` 导入完整数据。

生产环境建议把动作图片也上传到云存储，避免小程序线上环境受 GitHub 图片域名限制：

```json
{
  "limit": 50,
  "offset": 0,
  "uploadImages": true
}
```

如果完整导入图片，可以分批执行，例如 `offset` 分别为 `0`、`50`、`100`。`exerciseApi` 会把云存储 `fileID` 转成临时 URL 返回给小程序页面展示。

如果动作选择页提示动作库为空，说明小程序没有从云端拿到 `exercises` 数据。先确认：

- `exerciseApi` 已上传并部署
- `importExercises` 已成功运行
- 云数据库 `exercises` 集合里有数据
- 使用 `uploadImages: true` 导入时，云存储里出现了 `exercise-images/` 目录

导入前页面不会再显示本地默认动作图，以免把应用图标误认为真实动作图片。

动作数据源：

- <https://github.com/yuhonas/free-exercise-db>

## 小程序页面

- 今日：当天训练和饮食汇总
- 训练：点击动作图片选择动作，记录组数、次数、重量
- 饮食：记录餐次、食物、热量和蛋白质
- 历史：按日期查看汇总
