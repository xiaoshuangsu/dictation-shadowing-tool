#!/usr/bin/env node
/**
 * R2 缩略图压缩脚本
 *
 * 功能：
 * 1. 列出所有大于 20kb 的缩略图
 * 2. 使用 sharp 压缩到 20kb 以下
 * 3. 重新上传到 R2
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// 🔴 ES modules 中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// R2 配置（与 Python 脚本保持一致）
const R2_ACCOUNT_ID = '56f5f35ef68837e643bf13af9871c584';
const R2_BUCKET_NAME = 'shadowhub';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '90a0b35e59e38fc2a0f6f6eaaaa2a63f',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'ee6fb01f43cfcde19793142c57a857dcb1a24186f574303cbb0bba8ff03ce13a',
  },
});

/**
 * 列出所有缩略图
 */
async function listThumbnails() {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: 'thumbnails/',
  });

  const result = await r2Client.send(command);
  return result.Contents || [];
}

/**
 * 下载图片到临时文件
 */
async function downloadImage(key, localPath) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const result = await r2Client.send(command);
  const chunks = [];

  // 将 Body 转换为 Buffer
  for await (const chunk of result.Body) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(localPath, buffer);

  return buffer;
}

/**
 * 压缩图片到 20kb 以下
 */
async function compressImage(inputPath, outputPath, maxKb = 20) {
  const originalSize = fs.statSync(inputPath).size / 1024;
  console.log(`  原始大小: ${originalSize.toFixed(2)} KB`);

  if (originalSize <= maxKb) {
    console.log(`  ✅ 已小于 ${maxKb}KB，跳过`);
    return null;
  }

  // 渐进式压缩，从 quality 70 开始
  for (let quality = 70; quality >= 50; quality -= 5) {
    const info = await sharp(inputPath)
      .resize(854, 480, { fit: 'cover', position: 'center' }) // 16:9 480p
      .webp({ quality })
      .toFile(outputPath);

    const compressedSize = info.size / 1024;
    console.log(`  尝试 quality ${quality}: ${compressedSize.toFixed(2)} KB`);

    if (compressedSize <= maxKb) {
      console.log(`  ✅ 压缩成功: ${originalSize.toFixed(2)} KB → ${compressedSize.toFixed(2)} KB`);
      return outputPath;
    }
  }

  // 如果压缩到 50 还不行，尝试调整尺寸
  console.log(`  ⚠️ 质量压缩不足，尝试降低分辨率...`);

  for (let width of [640, 480, 320]) {
    const outputPath2 = outputPath.replace('.webp', `_w${width}.webp`);
    await sharp(inputPath)
      .resize(width, null, { fit: 'cover', position: 'center' })
      .webp({ quality: 70 })
      .toFile(outputPath2);

    const size = fs.statSync(outputPath2).size / 1024;
    console.log(`  尝试宽度 ${width}: ${size.toFixed(2)} KB`);

    if (size <= maxKb) {
      fs.renameSync(outputPath2, outputPath);
      console.log(`  ✅ 压缩成功: ${originalSize.toFixed(2)} KB → ${size.toFixed(2)} KB`);
      return outputPath;
    }
  }

  console.log(`  ❌ 无法压缩到 ${maxKb}KB 以下`);
  return null;
}

/**
 * 上传图片到 R2
 */
async function uploadImage(localPath, key) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fs.readFileSync(localPath),
    ContentType: 'image/webp',
  });

  await r2Client.send(command);
  console.log(`  ✅ 上传成功: ${key}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('=== R2 缩略图压缩脚本 ===\n');

  // 检查环境变量
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error('❌ 缺少 R2 凭证，请设置 R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  // 创建临时目录
  const tempDir = path.join(__dirname, '.temp-thumbnails');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // 列出所有缩略图
    console.log('📋 正在列出所有缩略图...');
    const thumbnails = await listThumbnails();
    console.log(`找到 ${thumbnails.length} 个缩略图\n`);

    let largeCount = 0;
    let processedCount = 0;
    let skippedCount = 0;

    for (const thumbnail of thumbnails) {
      const key = thumbnail.Key;
      const size = thumbnail.Size / 1024; // KB

      if (size > 20) {
        largeCount++;
        console.log(`\n🖼️  ${key} (${size.toFixed(2)} KB) - 超过 20KB`);

        // 下载
        const localPath = path.join(tempDir, path.basename(key));
        console.log(`  📥 下载中...`);
        await downloadImage(key, localPath);

        // 压缩
        console.log(`  🗜️  压缩中...`);
        const compressedPath = await compressImage(localPath, localPath + '.compressed.webp');

        if (compressedPath) {
          // 上传
          console.log(`  📤 上传中...`);
          await uploadImage(compressedPath, key);
          processedCount++;
        } else {
          console.log(`  ⚠️  跳过: ${key}`);
          skippedCount++;
        }

        // 清理临时文件
        try {
          fs.unlinkSync(localPath);
          if (compressedPath && fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
          }
        } catch (e) {
          // 忽略清理错误
        }
      }
    }

    console.log('\n=== 压缩完成 ===');
    console.log(`超过 20KB 的图片: ${largeCount}`);
    console.log(`成功压缩: ${processedCount}`);
    console.log(`跳过: ${skippedCount}`);

    // 清理临时目录
    try {
      fs.rmdirSync(tempDir);
    } catch (e) {
      // 忽略清理错误
    }

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

// 运行
main();
