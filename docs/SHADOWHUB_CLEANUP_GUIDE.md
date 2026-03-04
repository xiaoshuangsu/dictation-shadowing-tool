# Shadowhub 视频目录清理指南

由于 wrangler 不支持列出所有对象，我们有两种方法清理 shadowhub 目录：

---

## 方法 1：使用 Cloudflare Dashboard（推荐，最简单）

### 步骤 1：查看文件

1. 登录 https://dash.cloudflare.com/
2. 进入 **R2**
3. 选择 **engnovate-audio** bucket
4. 浏览文件夹：
   - `shadowhub/videos/`
   - `shadowhub/youtube_videos/`

### 步骤 2：手动清理

**删除重复文件：**
1. 找出 `youtube_videos/` 中与 `videos/` 重复的文件
2. 选中这些文件
3. 点击 **Delete**

**迁移剩余文件：**
1. 对于 `youtube_videos/` 中剩余的文件
2. 下载到本地
3. 上传到 `shadowhub/videos/`
4. 删除原文件

---

## 方法 2：使用 Python 脚本（需要配置凭证）

### 步骤 1：配置 R2 凭证

创建 `~/.aws/credentials` 文件：

```bash
mkdir -p ~/.aws
cat > ~/.aws/credentials << 'EOF'
[r2]
aws_access_key_id = YOUR_R2_ACCESS_KEY_ID
aws_secret_access_key = YOUR_R2_SECRET_ACCESS_KEY
EOF
```

**获取 R2 凭证：**
1. Cloudflare Dashboard → R2
2. 右上角 **"Manage R2 API Tokens"**
3. 创建 API Token
4. 记录 **Access Key ID** 和 **Secret Access Key**

### 步骤 2：安装依赖

```bash
pip3 install boto3 python-dotenv
```

### 步骤 3：运行清理脚本

```bash
python3 scripts/cleanup_shadowhub_videos.py
```

---

## 方法 3：使用 AWS CLI（推荐）

### 步骤 1：安装 AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 步骤 2：配置 AWS CLI

```bash
aws configure --profile r2
```

输入：
- **Access Key ID**: 你的 R2 Access Key ID
- **Secret Access Key**: 你的 R2 Secret Access Key
- **Default region name**: `auto`
- **Default output format**: `json`

### 步骤 3：列出文件

```bash
# 列出 shadowhub/videos/ 文件
aws s3 ls s3://engnovate-audio/shadowhub/videos/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2

# 列出 shadowhub/youtube_videos/ 文件
aws s3 ls s3://engnovate-audio/shadowhub/youtube_videos/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2
```

**替换 `<ACCOUNT_ID>` 为你的 R2 Account ID**（可以从 Cloudflare Dashboard → R2 查看）

### 步骤 4：删除重复文件

```bash
# 删除 youtube_videos/ 中的重复文件
aws s3 rm s3://engnovate-audio/shadowhub/youtube_videos/video1.mp4 --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2
```

### 步骤 5：移动文件

```bash
# 从 youtube_videos/ 移动到 videos/
aws s3 mv s3://engnovate-audio/shadowhub/youtube_videos/video2.mp4 s3://engnovate-audio/shadowhub/videos/video2.mp4 --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2
```

### 步骤 6：批量移动（高级）

```bash
# 移动 youtube_videos/ 中所有剩余文件到 videos/
aws s3 mv s3://engnovate-audio/shadowhub/youtube_videos/ s3://engnovate-audio/shadowhub/videos/ --recursive --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2
```

⚠️ **注意：`--recursive` 会移动整个目录，包括已经在 videos/ 中存在的文件，AWS 会自动跳过重复的。**

---

## 验证结果

清理完成后，验证：

```bash
# 检查 youtube_videos/ 是否为空
aws s3 ls s3://engnovate-audio/shadowhub/youtube_videos/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2

# 检查 videos/ 的文件数
aws s3 ls s3://engnovate-audio/shadowhub/videos/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --profile r2 | wc -l
```

预期结果：
- `youtube_videos/` 应该为空或返回错误
- `videos/` 应该包含所有视频文件

---

## 快速检查（当前状态）

如果你想快速查看当前状态，可以使用 Python 交互式：

```python
import boto3

# 配置
R2_ACCOUNT_ID = "YOUR_ACCOUNT_ID"  # 替换为你的 Account ID
ACCESS_KEY = "YOUR_ACCESS_KEY"     # 替换为你的 Access Key
SECRET_KEY = "YOUR_SECRET_KEY"     # 替换为你的 Secret Key

s3 = boto3.client('s3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY
)

# 列出文件
print("shadowhub/videos/:")
for obj in s3.list_objects_v2(Bucket='engnovate-audio', Prefix='shadowhub/videos/').get('Contents', []):
    print(f"  {obj['Key']}")

print("\nshadowhub/youtube_videos/:")
for obj in s3.list_objects_v2(Bucket='engnovate-audio', Prefix='shadowhub/youtube_videos/').get('Contents', []):
    print(f"  {obj['Key']}")
```

---

## 推荐：使用 AWS CLI + 批量移动

最简单的方法是使用 AWS CLI 的批量移动：

```bash
# 一次性移动所有文件（AWS 自动跳过重复的）
aws s3 mv s3://engnovate-audio/shadowhub/youtube_videos/ s3://engnovate-audio/shadowhub/videos/ \
  --recursive \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  --profile r2
```

这会：
1. 移动所有文件到 `videos/`
2. 自动跳过已存在的文件
3. 清空 `youtube_videos/` 目录
