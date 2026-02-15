# LeanCloud 设置指南

本项目使用 LeanCloud 作为后端服务，提供用户认证和数据存储功能。

## 第一步：注册 LeanCloud 账号

1. 访问 [LeanCloud 官网](https://leancloud.cn)
2. 点击右上角"创建账号"
3. 使用邮箱或手机号注册
4. 验证邮箱/手机号

## 第二步：创建应用

1. 登录后进入控制台
2. 点击"创建应用"
3. 选择"开发版"（免费）
4. 输入应用名称（如：dictation-tool）
5. 选择应用分类：其他
6. 点击"创建"

## 第三步：获取凭证

1. 进入刚创建的应用
2. 点击左侧菜单"设置" -> "应用凭证"
3. 记录以下三个值（后续需要）：
   - `App ID`
   - `App Key`
   - `服务器地址` (REST API 服务器地址，格式：https://xxx.leancloud.cn)

## 第四步：创建数据表

LeanCloud 会自动创建 `_User` 表（用户表）。

你需要手动创建以下两个表：

### 1. PracticeRecord 表（练习记录）

1. 点击左侧"数据存储" -> "结构化数据"
2. 点击"创建 Class"
3. Class 名称：`PracticeRecord`
4. 点击"创建"

添加以下字段（点击"添加列"）：

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| sentenceId | Number | 是 | - | 句子 ID |
| sentenceText | String | 是 | - | 句子文本 |
| practiceMode | String | 是 | - | 练习模式：dictation/shadowing |
| dictationMode | String | 否 | - | 听写模式：word/whole |
| isCorrect | Boolean | 是 | - | 是否正确 |
| usedShowWords | Boolean | 是 | false | 是否使用了提示 |
| audioTitle | String | 是 | - | 音频标题 |
| completedAt | Date | 是 | - | 完成时间 |

**注意**：
- `user` 字段会自动创建（Pointer 类型，指向 _User 表）
- `ACL` 字段会自动创建（权限控制）

### 2. UserStats 表（用户统计缓存）

1. 创建 Class：`UserStats`

添加以下字段：

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| totalPractices | Number | 是 | 0 | 总练习数 |
| totalCorrect | Number | 是 | 0 | 总正确数 |
| todayPractices | Number | 是 | 0 | 今日练习数 |
| lastPracticeDate | String | 是 | - | 最后练习日期 (YYYY-MM-DD) |

**注意**：
- `user` 字段会自动创建（Pointer 类型，指向 _User 表）
- `ACL` 字段会自动创建

## 第五步：配置环境变量

### GitHub Pages（开发环境）

1. 进入 GitHub 仓库
2. Settings -> Secrets and variables -> Actions
3. 点击"New repository secret"
4. 添加以下三个 secrets：

```
NEXT_PUBLIC_LEANCLOUD_APP_ID=你的App ID
NEXT_PUBLIC_LEANCLOUD_APP_KEY=你的App Key
NEXT_PUBLIC_LEANCLOUD_SERVER_URL=https://xxx.leancloud.cn
```

### 本地开发

在项目根目录的 `.env.local` 文件中添加（已创建）：

```env
NEXT_PUBLIC_LEANCLOUD_APP_ID=你的App ID
NEXT_PUBLIC_LEANCLOUD_APP_KEY=你的App Key
NEXT_PUBLIC_LEANCLOUD_SERVER_URL=https://xxx.leancloud.cn
```

**重要**：`.env.local` 文件已在 `.gitignore` 中，不会提交到 Git。

## 第六步：配置云端代码（Cloud Code）

云端代码用于自动更新 UserStats 统计数据。

1. 在 LeanCloud 控制台，点击"云端代码" -> "Hook 函数"
2. 创建 `afterSave` hook

**Hook 名称**: `PracticeRecord`
**Hook 类型**: `afterSave`
**代码**: 复制以下代码

```javascript
AV.Cloud.afterSave('PracticeRecord', function(request) {
  const user = request.object.get('user');

  // 查询用户的所有练习记录
  const query = new AV.Query('PracticeRecord');
  query.equalTo('user', user);
  query.find().then(function(records) {
    const total = records.length;
    const correct = records.filter(r => r.get('isCorrect')).length;

    // 获取今天的日期（YYYY-MM-DD）
    const today = new Date().toISOString().split('T')[0];

    // 查询今日练习
    const todayRecords = records.filter(r => {
      const completedAt = r.get('completedAt');
      if (!completedAt) return false;
      const dateStr = new Date(completedAt).toISOString().split('T')[0];
      return dateStr === today;
    });

    // 更新或创建统计记录
    const statsQuery = new AV.Query('UserStats');
    statsQuery.equalTo('user', user);
    statsQuery.first().then(function(stats) {
      if (!stats) {
        const UserStats = AV.Object.extend('UserStats');
        stats = new UserStats();
        stats.set('user', user);
      }

      stats.set('totalPractices', total);
      stats.set('totalCorrect', correct);
      stats.set('todayPractices', todayRecords.length);
      stats.set('lastPracticeDate', today);
      stats.save(null, {useMasterKey: true});
    });
  });
});
```

3. 点击"保存"

## 第七步：测试

1. 启动本地开发服务器：
```bash
npm run dev
```

2. 访问 http://localhost:3000/login

3. 测试注册功能：
   - 填写邮箱、用户名、密码
   - 点击"注册"
   - 应该自动登录并跳转到首页

4. 测试练习功能：
   - 完成一个练习
   - 检查 LeanCloud 控制台 -> 数据存储 -> PracticeRecord
   - 应该能看到一条新记录

5. 测试统计数据：
   - 检查 UserStats 表
   - 应该能看到自动更新的统计数据

6. 测试 Profile 页面：
   - 访问 /profile
   - 应该能看到统计卡片和练习历史

## 第八步：部署到 Cloudflare Pages

参考 [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)

## 常见问题

### 1. 如何查看数据？

进入控制台 -> 数据存储 -> 结构化数据 -> 选择表

### 2. 如何重置测试数据？

在数据表中点击"清空数据"

### 3. 免费版限制？

- 5000 个用户
- 2GB 数据库存储
- 每天 10 万次 API 请求

对个人项目完全够用。

### 4. 数据安全？

- 所有数据都有 ACL 保护，用户只能访问自己的数据
- 不要在代码中暴露 Master Key
- NEXT_PUBLIC_ 前缀的环境变量会在前端暴露，这是正常的（LeanCloud 设计如此）

### 5. 如何备份数据？

控制台 -> 数据存储 -> 数据导出 -> 选择格式（JSON/CSV）

## 下一步

- [ ] 测试完整用户流程
- [ ] 测试多用户数据隔离
- [ ] 测试跨浏览器登录状态
- [ ] 部署到 Cloudflare Pages
