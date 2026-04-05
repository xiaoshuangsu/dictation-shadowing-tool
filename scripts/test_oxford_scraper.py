#!/usr/bin/env python3
"""
Oxford 3000 抓取测试脚本
测试抓取 5 个单词，生成 oxford_test.json
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from urllib.parse import urljoin
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
                full_url = urljoin(BASE_URL, href)
                learn_links.append(full_url)
                if len(learn_links) >= limit:
                    break

    return learn_links


def extract_words_from_learn_page(url):
    """从 Learn 页面提取单词数据"""
    print(f"  📄 正在抓取: {url}")

    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        words = []

        # 查找主要内容区域（通常在 article 或 main 标签中）
        main_content = soup.find('article') or soup.find('main') or soup.find('body')

        if not main_content:
            return words

        # 获取纯文本内容
        text = main_content.get_text(separator='\n')

        # 按照页面格式解析单词
        # 格式：单词\n\n(词性) /音标/\n释义\nExample: 例句\n\n
        lines = text.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # 跳过空行和无关内容
            if not line or len(line) > 50 or 'Terms' in line or 'Flip' in line or 'Type' in line:
                i += 1
                continue

            # 检查是否为单词（小写字母，3-15个字符）
            if line.islower() and line.isalpha() and 3 <= len(line) <= 15:
                word = line

                # 检查下一行是否包含词性和音标
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()

                    # 匹配格式：或
                    if next_line.startswith('(') and ')' in next_line:
                        # 提取词性
                        pos_match = re.search(r'\((v|n|adj|adv|prep|conj|pron|interj)\)', next_line)
                        part_of_speech = pos_match.group(1) if pos_match else ''

                        # 提取音标
                        ipa_match = re.search(r'/[^/]+/', next_line)
                        phonetic = ipa_match.group(0) if ipa_match else ''

                        # 查找释义（在词性行之后）
                        definition = ''
                        example = ''

                        # 检查后续行
                        j = i + 2
                        while j < len(lines) and j < i + 10:
                            def_line = lines[j].strip()

                            if not def_line:
                                j += 1
                                continue

                            # 遇到下一个单词就停止
                            if def_line.islower() and def_line.isalpha() and len(def_line) <= 15:
                                break

                            # 提取例句
                            if def_line.startswith('Example:'):
                                example = def_line.replace('Example:', '').strip()
                            # 提取释义（非例句的内容）
                            elif not def_line.startswith('('):
                                if definition:
                                    definition += ' ' + def_line
                                else:
                                    definition = def_line

                            j += 1

                        if definition:
                            words.append({
                                'word': word,
                                'part_of_speech': part_of_speech,
                                'phonetic': phonetic,
                                'definition': definition,
                                'example': example,
                                'source_url': url
                            })

                            if len(words) >= 10:
                                break

                        i = j  # 跳过已处理的行
                        continue

            i += 1

        return words

    except Exception as e:
        print(f"  ❌ 抓取失败: {e}")
        return []


def clean_definition(text):
    """清理定义文本，提取结构化数据"""
    # 示例文本：
    # act
    # (v) /ækt/
    # to do something for a particular purpose or to solve a problem
    # Example: We need to act quickly.

    lines = text.split('\n')
    lines = [line.strip() for line in lines if line.strip()]

    if len(lines) < 2:
        return {'definition': text}

    result = {}

    # 第一行通常是单词
    if lines:
        result['word'] = lines[0]

    # 查找词性和音标
    for line in lines[1:]:
        # 匹配词性: (v), (n), (adj), (adv)
        pos_match = re.search(r'\((v|n|adj|adv|prep|conj|pron|interj)\)', line)
        if pos_match:
            result['part_of_speech'] = pos_match.group(1)
            # 提取音标
            ipa_match = re.search(r'/[^/]+/', line)
            if ipa_match:
                result['phonetic'] = ipa_match.group(0)
            continue

        # 查找例句
        if line.startswith('Example:'):
            result['example'] = line.replace('Example:', '').strip()
            continue

        # 其他内容作为定义
        if 'definition' not in result:
            result['definition'] = line
        else:
            result['definition'] += ' ' + line

    return result


def main():
    print("=" * 70)
    print("Oxford 3000 抓取测试脚本")
    print("=" * 70)
    print()

    # 1. 获取前 5 个 Learn 链接
    learn_links = fetch_learn_links(limit=5)

    print(f"\n✅ 找到 {len(learn_links)} 个 Learn 页面")
    for i, link in enumerate(learn_links, 1):
        print(f"  {i}. {link}")

    # 2. 抓取单词数据
    print(f"\n📖 开始抓取单词...")
    all_words = []

    for i, url in enumerate(learn_links, 1):
        print(f"\n[{i}/{len(learn_links)}] {url}")
        words = extract_words_from_learn_page(url)
        print(f"  提取到 {len(words)} 个单词")
        all_words.extend(words)

        # 礼貌性延迟
        time.sleep(1)

        # 限制总单词数
        if len(all_words) >= 5:
            break

    # 3. 清理和结构化数据
    print(f"\n🔧 清理和结构化数据...")
    structured_words = []

    for word_data in all_words[:5]:  # 只取前 5 个
        cleaned = clean_definition(word_data.get('definition', ''))
        cleaned['word'] = word_data.get('word', '')
        cleaned['source_url'] = word_data.get('source_url', '')
        structured_words.append(cleaned)

    # 4. 保存到 JSON
    output_file = '/Users/a/dictation/oxford_test.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(structured_words, f, indent=2, ensure_ascii=False)

    print(f"\n✅ 成功保存 {len(structured_words)} 个单词到: {output_file}")

    # 5. 显示预览
    print(f"\n📋 数据预览:")
    print("=" * 70)
    for word in structured_words[:3]:
        print(f"\n单词: {word.get('word', 'N/A')}")
        print(f"词性: {word.get('part_of_speech', 'N/A')}")
        print(f"音标: {word.get('phonetic', 'N/A')}")
        print(f"释义: {word.get('definition', 'N/A')[:100]}...")
        if 'example' in word:
            print(f"例句: {word['example'][:80]}...")

    print(f"\n" + "=" * 70)
    print(f"✅ 测试完成！请检查 {output_file}")


if __name__ == '__main__':
    main()
