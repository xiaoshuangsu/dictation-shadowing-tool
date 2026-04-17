#!/usr/bin/env python3
"""
YouTube 批量素材录入工具 - v2.2 批量版
改进：
1. 支持批量处理多个视频
2. 每完成一个视频立即入库（避免数据丢失）
3. 支持断点恢复（跳过已入库的视频）
"""

import os
import sys
import json
from pathlib import Path
from supabase import create_client, Client
from typing import List, Dict

# 添加脚本目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入现有脚本的核心函数
from ingest_youtube_ytdlp import (
    fetch_youtube_metadata,
    normalize_transcript,
    generate_blanks_for_transcript,
    generate_translations_for_transcript,
    upsert_material,
    log
)

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

DEFAULT_CATEGORY = "Science and Facts"
DEFAULT_DIFFICULTY = "B2"

# 分类参数映射（用户输入的简短参数 → 数据库中的中文名称）
CATEGORY_PARAM_MAP = {
    'daily': '日常生活',
    'heart': '心灵故事',
    'science': 'Science and Facts',
    'ted': 'TED演讲',
    'ielts': 'IELTS Listening',
    'bbc': 'BBC Learning English',
    'culture': '文化历史',
    'art': '艺术文化',
    'story': '故事',
    'cartoon': '动画片',
    'interview': '人物访谈',
}

# 进度文件
PROGRESS_FILE = Path("/tmp/youtube_batch_progress.json")


def load_progress() -> Dict:
    """加载进度"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed": [], "failed": []}


def save_progress(progress: Dict):
    """保存进度"""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)


def is_video_completed(client: Client, video_id: str) -> bool:
    """检查视频是否已入库"""
    try:
        result = client.table('materials').select('id').eq('youtube_id', video_id).execute()
        return len(result.data) > 0
    except:
        return False


def process_single_video(
    client: Client,
    video_url: str,
    category: str,
    difficulty: str,
    skip_completed: bool = True
) -> bool:
    """处理单个视频"""
    try:
        # 1. 抓取视频元数据和字幕
        metadata = fetch_youtube_metadata(video_url)

        if not metadata['title']:
            log("   ❌ 无法提取视频标题")
            return False

        if not metadata['subtitles']:
            log("   ❌ 无法提取字幕")
            return False

        video_id = metadata['video_id']

        # 检查是否已完成
        if skip_completed and is_video_completed(client, video_id):
            log(f"   ⏭️  视频已入库，跳过: {metadata['title']}")
            return True

        log(f"   📹 开始处理: {metadata['title']}")
        log(f"      视频ID: {video_id}")

        # 2. 格式化字幕（智能断句 + 时间轴优化）
        transcript = normalize_transcript(metadata['subtitles'])

        if not transcript:
            log("   ❌ 字幕解析失败")
            return False

        log(f"      断句完成: {len(transcript)} 条")

        # 3. 智能挖空（v6.2 逻辑）
        blank_count, weight_stats = generate_blanks_for_transcript(transcript)
        log(f"      挖空完成: {blank_count} 句成功")

        # 4. 19国语言翻译（原有 3 种 + Group A + Group B）
        translate_success, translate_failed, failed_groups = generate_translations_for_transcript(transcript)
        log(f"      翻译完成: 成功 {translate_success}, 失败 {translate_failed}")

        # 5. 立即入库（避免数据丢失）
        success = upsert_material(client, metadata, transcript, category, difficulty, failed_groups)

        if success:
            log(f"   ✅ 入库成功: {metadata['title']}")
            return True
        else:
            log(f"   ❌ 入库失败: {metadata['title']}")
            return False

    except Exception as e:
        log(f"   ❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def batch_process_videos(
    video_urls: List[str],
    category: str = DEFAULT_CATEGORY,
    difficulty: str = DEFAULT_DIFFICULTY,
    skip_completed: bool = True
):
    """批量处理视频"""
    print("=" * 70)
    print("🎯 YouTube 批量素材录入工具 - v2.2 批量版")
    print("=" * 70)
    print(f"📚 分类: {category}")
    print(f"📊 难度: {difficulty}")
    print(f"📹 视频数量: {len(video_urls)}")
    print(f"⏭️  跳过已完成: {'是' if skip_completed else '否'}")
    print("=" * 70)
    print()

    # 连接 Supabase
    log("🔗 连接 Supabase...")
    client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    log("✅ 连接成功\n")

    # 加载进度
    progress = load_progress()
    completed = set(progress['completed'])
    failed = set(progress['failed'])

    # 统计
    total = len(video_urls)
    success_count = 0
    fail_count = 0
    skip_count = 0

    for idx, video_url in enumerate(video_urls, 1):
        print(f"\n[{idx}/{total}] 处理视频: {video_url}")
        print("-" * 70)

        # 检查是否已处理过
        if video_url in completed:
            log("   ⏭️  已完成，跳过")
            skip_count += 1
            continue
        elif video_url in failed:
            log("   🔄 之前失败，重试")

        # 处理视频
        success = process_single_video(client, video_url, category, difficulty, skip_completed)

        # 更新进度
        if success:
            completed.add(video_url)
            if video_url in failed:
                failed.remove(video_url)
            success_count += 1
        else:
            failed.add(video_url)
            fail_count += 1

        # 保存进度（每完成一个就保存）
        progress['completed'] = list(completed)
        progress['failed'] = list(failed)
        save_progress(progress)

    # 总结
    print("\n" + "=" * 70)
    print("📊 批量处理完成")
    print("=" * 70)
    print(f"✅ 成功: {success_count}")
    print(f"❌ 失败: {fail_count}")
    print(f"⏭️  跳过: {skip_count}")
    print(f"📁 进度文件: {PROGRESS_FILE}")
    print("=" * 70)


def print_help():
    print("""
用法: python3 scripts/ingest_youtube_batch.py <URL1> [URL2] [URL3] ... [选项]

选项:
  --category <分类>    设置分类（支持简短参数: daily, heart, science 等）
  --difficulty <难度>  设置难度（默认: B2）
  --force              强制重新处理已入库的视频
  --help, -h           显示帮助信息

简短参数映射:
  daily     → 日常生活
  heart     → 心灵故事
  science   → Science and Facts
  ted       → TED演讲
  ielts     → IELTS Listening
  bbc       → BBC Learning English
  culture   → 文化历史
  art       → 艺术文化
  story     → 故事
  cartoon   → 动画片
  interview → 人物访谈

示例:
  # 处理单个视频（使用简短参数）
  python3 scripts/ingest_youtube_batch.py "https://youtu.be/xxxxx" --category daily

  # 批量处理多个视频（使用中文分类名）
  python3 scripts/ingest_youtube_batch.py "https://youtu.be/xxxxx" "https://youtu.be/yyyyy" --category "心灵故事"

  # 指定分类和难度
  python3 scripts/ingest_youtube_batch.py "https://youtu.be/xxxxx" --category heart --difficulty B2
    """)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')

    if len(sys.argv) < 2 or '--help' in sys.argv or '-h' in sys.argv:
        print_help()
        sys.exit(0)

    # 解析参数
    video_urls = []
    category = DEFAULT_CATEGORY
    difficulty = DEFAULT_DIFFICULTY
    skip_completed = True

    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg.startswith('http'):
            video_urls.append(arg)
            i += 1
        elif arg == '--category' and i + 1 < len(sys.argv):
            raw_category = sys.argv[i + 1]
            # 🔄 分类参数映射：支持简短参数
            category = CATEGORY_PARAM_MAP.get(raw_category.lower(), raw_category)
            i += 2
        elif arg == '--difficulty' and i + 1 < len(sys.argv):
            difficulty = sys.argv[i + 1]
            i += 2
        elif arg == '--force':
            skip_completed = False
            i += 1
        else:
            i += 1

    if not video_urls:
        print("❌ 错误: 请提供至少一个视频 URL")
        print_help()
        sys.exit(1)

    # 批量处理
    batch_process_videos(video_urls, category, difficulty, skip_completed)
