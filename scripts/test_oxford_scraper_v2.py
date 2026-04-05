#!/usr/bin/env python3
"""
Oxford 3000 抓取测试脚本 V2
使用纯文本解析，直接提取单词数据
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re

BASE_URL = "https://engnovate.com"
CATEGORY_URL = f"{BASE_URL}/flashcards/?category=oxford-3000"

# 创建会话，添加 User-Agent
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
})


def fetch_learn_links(limit=5):
    """从目录页获取前 limit 个 Learn 链接"""
    print(f"📖 正在获取目录页: {CATEGORY_URL}")

    response = session.get(CATEGORY_URL, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')

    # 查找所有 Learn 链接
    learn_links = []

    # 直接查找所有包含 "Learn" 文本的链接
    all_links = soup.find_all('a')
    for link in all_links:
        if link.text.strip() == 'Learn':
            href = link.get('href')
            if href and '/flashcards/' in href:
                learn_links.append(href)
                if len(learn_links) >= limit:
                    break

    return learn_links


def extract_words_from_learn_page(url):
    """从 Learn 页面提取单词数据"""
    print(f"  📄 正在抓取: {url}")

    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        # 使用 BeautifulSoup 获取纯文本
        soup = BeautifulSoup(response.text, 'html.parser')

        # 获取纯文本
        text = soup.get_text(separator='\n')

        words = []

        # 解析单词数据
        # 格式：单词\n\n(词性) /音标/\n释义\nExample: 例句\n\n
        lines = text.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # 跳过空行、菜单、标题
            if not line or len(line) > 50:
                i += 1
                continue

            # 跳过明显的标题行
            if any(keyword in line.lower() for keyword in ['menu', 'course', 'search', 'login', 'plans', 'pricing', 'copyright']):
                i += 1
                continue

            # 检查是否为单词（小写字母，3-12个字符）
            if line.islower() and line.isalpha() and 3 <= len(line) <= 12:
                word = line

                # 检查下一行是否包含词性和音标
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()

                    # 匹配格式：
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

                        # 检查后续行
                        j = i + 2
                        while j < len(lines) and j < i + 15:
                            def_line = lines[j].strip()

                            if not def_line:
                                j += 1
                                continue

                            # 遇到下一个单词就停止
                            if def_line.islower() and def_line.isalpha() and len(def_line) <= 12:
                                break

                            # 遇到明显的分隔符就停止
                            if def_line in ['---', 'Flip', 'Type', 'Terms']:
                                break

                            # 提取例句
                            if def_line.startswith('Example:'):
                                example = def_line.replace('Example:', '').strip()
                            # 提取释义（非例句的内容）
                            elif not def_line.startswith('('):
                                # 过滤掉无关内容
                                if any(keyword in def_line.lower() for keyword in ['menu', 'comment', 'reply', 'cancel']):
                                    j += 1
                                    continue

                                if definition:
                                    definition += ' ' + def_line
                                else:
                                    definition = def_line

                            j += 1

                        # 只保留有效的定义（长度合理）
                        if definition and 10 < len(definition) < 200:
                            words.append({
                                'word': word,
                                'part_of_speech': part_of_speech,
                                'phonetic': phonetic,
                                'definition': definition.strip(),
                                'example': example,
                                'source_url': url
                            })

                        i = j  # 跳过已处理的行
                        continue

            i += 1

        print(f"  ✅ 提取到 {len(words)} 个单词")
        return words

    except Exception as e:
        print(f"  ❌ 抓取失败: {e}")
        return []


def main():
    print("=" * 70)
    print("Oxford 3000 抓取测试脚本 V2")
    print("=" * 70)
    print()

    # 1. 获取前 5 个 Learn 链接
    learn_links = fetch_learn_links(limit=5)

    print(f"\n✅ 找到 {len(learn_links)} 个 Learn 页面")

    # 2. 抓取单词数据
    print(f"\n📖 开始抓取单词...")
    all_words = []

    for i, url in enumerate(learn_links, 1):
        print(f"\n[{i}/{len(learn_links)}] {url}")
        words = extract_words_from_learn_page(url)
        all_words.extend(words)

        # 礼貌性延迟
        time.sleep(1)

        # 限制总单词数
        if len(all_words) >= 5:
            break

    # 3. 保存到 JSON
    output_file = '/Users/a/dictation/oxford_test.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_words[:5], f, indent=2, ensure_ascii=False)

    print(f"\n✅ 成功保存 {len(all_words[:5])} 个单词到: {output_file}")

    # 4. 显示预览
    print(f"\n📋 数据预览:")
    print("=" * 70)
    for word in all_words[:3]:
        print(f"\n单词: {word.get('word', 'N/A')}")
        print(f"词性: {word.get('part_of_speech', 'N/A')}")
        print(f"音标: {word.get('phonetic', 'N/A')}")
        print(f"释义: {word.get('definition', 'N/A')}")
        if word.get('example'):
            print(f"例句: {word['example'][:80]}...")

    print(f"\n" + "=" * 70)
    print(f"✅ 测试完成！请检查 {output_file}")


if __name__ == '__main__':
    main()
