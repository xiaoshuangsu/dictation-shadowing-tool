/**
 * 生成多种尺寸的图标
 * 需要先安装: npm install sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG_SOURCE = path.join(__dirname, '../public/icon-512.svg');
const PUBLIC_DIR = path.join(__dirname, '../public');

// 图标尺寸配置
const ICONS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'icon.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generateIcons() {
  console.log('🎨 开始生成图标...\n');

  for (const icon of ICONS) {
    try {
      const outputPath = path.join(PUBLIC_DIR, icon.name);

      await sharp(SVG_SOURCE)
        .resize(icon.size, icon.size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ 已生成: ${icon.name} (${icon.size}x${icon.size})`);
    } catch (error) {
      console.error(`❌ 生成失败: ${icon.name}`, error.message);
    }
  }

  // 复制 SVG 作为 favicon.svg
  const svgFaviconPath = path.join(PUBLIC_DIR, 'favicon.svg');
  fs.copyFileSync(SVG_SOURCE, svgFaviconPath);
  console.log(`✅ 已生成: favicon.svg`);

  console.log('\n🎉 图标生成完成！');
}

generateIcons().catch(console.error);
