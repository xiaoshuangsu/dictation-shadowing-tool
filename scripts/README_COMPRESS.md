# R2 缩略图压缩脚本

## 问题
部分缩略图超过 20KB，导致移动端加载缓慢。

## 解决方案

### 1. 压缩现有缩略图

```bash
cd /Users/a/dictation/scripts

# 安装依赖（首次运行）
npm install

# 设置 R2 凭证（环境变量）
export R2_ACCESS_KEY_ID="your-access-key-id"
export R2_SECRET_ACCESS_KEY="your-secret-access-key"

# 运行压缩脚本
npm run compress
```

### 2. 更新自动化流程

已更新 `sync_all.py` 中的缩略图生成逻辑：
- WebP quality 从 85 降低到 70
- 添加 `-method 6` 提高压缩效率
- 自动检查文件大小，超过 20KB 自动重新压缩
- 如果质量压缩不够，自动降低分辨率

### 3. 验证

压缩完成后，访问 http://10.104.15.185:3000/topics 检查：
- 封面图加载速度
- 控制台 Network 面板查看文件大小

## 注意事项

- 压缩脚本是临时的，只运行一次
- 新生成的缩略图会自动小于 20KB
- 如果某些图片压缩失败，会被跳过并记录
