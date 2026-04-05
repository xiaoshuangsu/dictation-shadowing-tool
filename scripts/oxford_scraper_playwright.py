#!/usr/bin/env python3
"""
Oxford 3000 抓取脚本 - Playwright 版本
通过监听网络请求获取音频链接
"""

import asyncio
import json
import re
from urllib.parse import urljoin
from playwright.async_api import async_playwright, Page, Browser
from typing import List, Dict, Optional

BASE_URL = "https://engnovate.com"
CATEGORY_URL = f"{BASE_URL}/flashcards/?category=oxford-3000"


class OxfordScraper:
    def __init__(self):
        self.audio_urls = {}  # 存储音频链接 {word: url}

    async def fetch_learn_links(self, page: Page, limit: int = 5) -> List[str]:
        """获取 Learn 链接"""
        print(f"📖 正在获取目录页: {CATEGORY_URL}")

        await page.goto(CATEGORY_URL, wait_until='networkidle', timeout=30000)

        # 查找所有 Learn 链接
        learn_links = await page.locator('a:has-text("Learn")').all()
        links = []

        for i, link in enumerate(learn_links):
            if i >= limit:
                break
            href = await link.get_attribute('href')
            if href and '/flashcards/' in href:
                full_url = urljoin(BASE_URL, href)
                links.append(full_url)

        print(f"✅ 找到 {len(links)} 个 Learn 页面")
        return links

    async def setup_audio_listener(self, page: Page, current_word: str):
        """设置音频请求监听器"""
        async def handle_request(request):
            url = request.url
            # 监听 .mp3 或 .wav 音频文件
            if '.mp3' in url or '.wav' in url or 'audio' in url.lower():
                print(f"  🔊 捕获音频请求: {url}")
                self.audio_urls[current_word] = url

        page.on('request', handle_request)

    async def extract_words_with_audio(self, page: Page, url: str, max_words: int = 5) -> List[Dict]:
        """提取单词并捕获音频链接"""
        print(f"\n📄 正在抓取: {url}")

        try:
            await page.goto(url, wait_until='networkidle', timeout=30000)

            # 获取页面文本内容
            text_content = await page.inner_text('body')

            # 解析单词
            words = self.parse_words_from_text(text_content, url)

            # 为每个单词查找音频按钮并点击
            for word in words[:max_words]:
                word_text = word['word']
                print(f"\n  🔍 查找音频: {word_text}")

                # 设置音频监听器
                self.audio_urls[word_text] = None
                await self.setup_audio_listener(page, word_text)

                # 尝试查找并点击发音按钮
                # 常见的发音按钮选择器
                audio_selectors = [
                    'button[title*="play" i]',
                    'button[aria-label*="audio" i]',
                    'button[aria-label*="pronunciation" i]',
                    '.audio-button',
                    '.pronunciation-button',
                    'i.fa-volume-up',  # 音量图标
                    'button:has(i.fa-volume-up)',
                    'span:has(i.fa-volume-up)',
                    '[class*="audio"]',
                    '[class*="speaker"]',
                ]

                audio_clicked = False
                for selector in audio_selectors:
                    try:
                        elements = await page.locator(selector).all()
                        for element in elements:
                            if await element.is_visible():
                                await element.click()
                                audio_clicked = True
                                print(f"    ✅ 点击了音频按钮: {selector}")

                                # 等待音频请求
                                await asyncio.sleep(2)

                                # 检查是否捕获到音频
                                if self.audio_urls.get(word_text):
                                    word['audio_url'] = self.audio_urls[word_text]
                                    print(f"    🎵 音频 URL: {word['audio_url']}")
                                    break

                        if self.audio_urls.get(word_text):
                            break

                    except Exception as e:
                        continue

                if not audio_clicked or not self.audio_urls.get(word_text):
                    print(f"    ⚠️  未找到音频按钮")

                # 短暂延迟，避免过快操作
                await asyncio.sleep(1)

            return words[:max_words]

        except Exception as e:
            print(f"  ❌ 抓取失败: {e}")
            return []

    def parse_words_from_text(self, text: str, source_url: str) -> List[Dict]:
        """从文本中解析单词"""
        words = []
        lines = text.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # 跳过空行和无关内容
            if not line or len(line) > 50:
                i += 1
                continue

            # 检查是否为单词
            if line.islower() and line.isalpha() and 3 <= len(line) <= 12:
                word = line

                # 检查下一行是否包含词性和音标
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()

                    if next_line.startswith('(') and ')' in next_line:
                        # 提取词性
                        pos_match = re.search(r'\((v|n|adj|adv)\)', next_line)
                        part_of_speech = pos_match.group(1) if pos_match else ''

                        # 提取音标
                        ipa_match = re.search(r'/[^/]+/', next_line)
                        phonetic = ipa_match.group(0) if ipa_match else ''

                        # 查找释义和例句
                        definition = ''
                        example = ''

                        j = i + 2
                        while j < len(lines) and j < i + 15:
                            def_line = lines[j].strip()

                            if not def_line:
                                j += 1
                                continue

                            if def_line.islower() and def_line.isalpha() and len(def_line) <= 12:
                                break

                            if def_line in ['---', 'Flip', 'Type', 'Terms']:
                                break

                            if def_line.startswith('Example:'):
                                example = def_line.replace('Example:', '').strip()
                            elif not def_line.startswith('('):
                                if any(keyword in def_line.lower() for keyword in ['menu', 'comment', 'reply']):
                                    j += 1
                                    continue

                                if definition:
                                    definition += ' ' + def_line
                                else:
                                    definition = def_line

                            j += 1

                        if definition and 10 < len(definition) < 200:
                            words.append({
                                'word': word,
                                'part_of_speech': part_of_speech,
                                'phonetic': phonetic,
                                'definition': definition.strip(),
                                'example': example,
                                'audio_url': None,  # 稍后填充
                                'source_url': source_url
                            })

                        i = j
                        continue

            i += 1

        return words


async def verify_audio_url(url: str) -> bool:
    """验证音频 URL 是否可访问"""
    import requests
    try:
        response = requests.head(url, timeout=10)
        is_valid = response.status_code == 200
        content_type = response.headers.get('content-type', '')
        print(f"    验证音频: {url}")
        print(f"      状态: {response.status_code}")
        print(f"      类型: {content_type}")
        return is_valid and 'audio' in content_type.lower()
    except Exception as e:
        print(f"    ❌ 音频验证失败: {e}")
        return False


async def main():
    print("=" * 70)
    print("Oxford 3000 抓取脚本 - Playwright 版本")
    print("=" * 70)

    scraper = OxfordScraper()
    all_words = []

    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)  # headless=False 可以看到浏览器操作
        page = await browser.new_page()

        try:
            # 1. 获取 Learn 链接
            learn_links = await scraper.fetch_learn_links(page, limit=3)

            if not learn_links:
                print("❌ 未找到 Learn 链接")
                return

            # 2. 抓取单词和音频
            for i, url in enumerate(learn_links, 1):
                print(f"\n{'='*70}")
                print(f"[{i}/{len(learn_links)}] {url}")
                print(f"{'='*70}")

                words = await scraper.extract_words_with_audio(page, url, max_words=3)
                all_words.extend(words)

                if len(all_words) >= 5:
                    break

                await asyncio.sleep(2)

        finally:
            await browser.close()

    # 3. 验证音频 URL
    print(f"\n{'='*70}")
    print("🔊 验证音频 URL")
    print(f"{'='*70}")

    for word in all_words:
        if word.get('audio_url'):
            is_valid = await verify_audio_url(word['audio_url'])
            word['audio_verified'] = is_valid

    # 4. 保存结果
    output_file = '/Users/a/dictation/oxford_test.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_words[:5], f, indent=2, ensure_ascii=False)

    print(f"\n✅ 成功保存 {len(all_words[:5])} 个单词到: {output_file}")

    # 5. 显示预览
    print(f"\n📋 数据预览:")
    print(f"{'='*70}")
    for word in all_words[:3]:
        print(f"\n单词: {word.get('word')}")
        print(f"词性: {word.get('part_of_speech')}")
        print(f"音标: {word.get('phonetic')}")
        print(f"释义: {word.get('definition')}")
        if word.get('audio_url'):
            status = "✅" if word.get('audio_verified') else "❌"
            print(f"音频: {status} {word['audio_url']}")
        else:
            print(f"音频: ❌ 未找到")

    print(f"\n{'='*70}")
    print("✅ 测试完成！")


if __name__ == '__main__':
    asyncio.run(main())
