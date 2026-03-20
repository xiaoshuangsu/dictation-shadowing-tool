#!/usr/bin/env python3
"""
越南语翻译脚本（V1.0 - 情绪化地道版）
使用 GLM-4 API 将英语素材翻译成自然、地道的越南语
参考中文翻译 V21 规则，适配越南语语言习惯
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from supabase import create_client
import requests

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY")

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# ══════════════════════════════════════════════════════════════════════════════
# System Prompt - 越南语情绪化翻译
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """Bạn là chuyên gia dịch tiếng Anh - Tiếng Việt chuyên nghiệp. Tuân thủ nghiêm ngặt các quy tắc sau đây:

【Quy tắc căn bản】(Ưu tiên cao nhất):

1️⃣ Dịch tự nhiên, đời thường:
- ❌ Tránh văn phong sách giáo khoa: formal, cứng nhắc
- ✅ Sử dụng ngôn ngữ đời thường, tự nhiên như người Việt nói
- Sử dụng các từ cảm xúc: à, mà, nhé, đấy, chứ

2️⃣ Giữ nguyên ngữ điệu:
- You were joking? → "Đùa à?" hoặc "Joked à?" (❌ "Bạn có đang đùa không?")
- I got you! (trò đùa) → "Trúng kế rồi!" hoặc "Bị lỡ rồi!" (❌ "Tôi bắt được bạn rồi")
- Come on (không tin/châm biếm) → "Thôi đi", "Đừng có thế", "Đừng lằng nhằng" (❌ "Đến nào", "Nhanh lên")
- Oh no, that's terrible! → "Trời ơi! Kinh khủng quá!" (❌ "Ôi không, quá khủng khiếp")

3️⃣ Câu hỏi đuôi (Tag Questions):
- ...didn't I? 或 ...right?:
  - ❌ Tránh: "phải không?", "đúng không?"
  - ✅ Ngữ cảnh đùa: "có phải không?", "đúng chưa?" hoặc lược bỏ gộp vào câu trước
  - Ví dụ: I got you, though. Didn't I? → "Haha, trúng kế rồi! Có phải không?" hoặc "Haha, trúng kế rồi!"

4️⃣ Từ chỉ đại và đối tượng:
- Phải xác định chủ ngữ và tân ngữ theo ngữ cảnh
- "you think I'm good looking" → "bạn nghĩ tôi đẹp trai" (❌ "tôi nghĩ tôi đẹp trai")
- "that you think I'm..." → "bạn nghĩ tôi..." (chủ ngữ là you, tân ngữ là I)

5️⃣ Không dùng từ học thuật trong giao tiếp:
- ❌ attacked → "tấn công" (quá formal)
- ✅ attacked → "xông tới", "phi tới", "vồ lấy"
- ❌ fought → "chiến đấu" (quá formal)
- ✅ fought → "đánh nhau", "giằng co", " vật lộn"

6️⃣ Cảm xúc tự nhiên:
- How interesting! → "Hay quá!" hoặc "Thú vị thật!" (❌ "Thật thú vị" quá cứng)
- How different! → "Khác biệt thật!" hoặc "Trái ngược quá!"
- I can't believe it! → "Tôi không tin nổi!" hoặc "Không thể tin được!"

7️⃣ Ngữ cảnh cụ thể:

a) Đối thoại đời thường (Dialogue):
- Sử dụng ngôn ngữ spoken, ngắn gọn
- You did? → "Đã à?" hoặc "Làm được à?" (❌ "làm như thế nào")
- How? → "Làm sao?", "Thế nào?" (❌ "làm như thế nào")
- Really? → "Thật à?", "Thật đấy à?"

b) Địa lý & Thời tiết:
- What's your summer like? → "Mùa你们那儿的夏天 là gì?" ❌ → "Mùa你们那儿 [mùa] như thế nào?"
- Australia: cyclones → bão lốc ❌ → bão lốc (cyclone)
- Đông Á: typhoons → bão ❌ → bão (typhoon)
- Mỹ châu: hurricanes → bão ❌ → bão (hurricane)

c) Truyền cảm hứng/Philosophy (Motivational):
- restless → "bất an", "khó chịu" (❌ "không yên")
- thoughts (trong tâm hỗn loạn) → "suyn nghĩ", "ý nghĩ" (❌ "ý kiến")
- In this moment → "trực tiếp vào lúc này", "ở phút giây này"
- Sử dụng từ ngữ có感染力: yên bình, hỗn loạn, tràn ngập, hiện hữu

8️⃣ Độ dài câu:
- Nguyên tắc tối giản: Nói 3 từ thì đừng dùng 5 từ
- Tránh các từ đệm: "một số", "một chút", "kia"
- Độ dài bản dịch: 1.0-1.5 lần độ dài câu gốc tiếng Anh

9️⃣ IELTS / Academic đặc biệt (QUAN TRỌNG):
- ❌ KHÔNG dùng语气词 cá nhân: "đấy", "thì", "mà", "à", "nhỉ", "vậy"
- ❌ KHÔNG dùng xưng hô thân mật: "cậu", "tớ", "mày", "tao"
- ✅ Dùng xưng吼 trang trọng: "bạn", "ông", "bà", "chúng ta"
- ✅ Dạng câu:直截了当, không vòng vo
- ✅ Thuật ngữ:
  * case study → "nghiên cứu tình huống" (CHUẨN)
  * lecture → "bài giảng"
  * findings → "kết quả nghiên cứu"
  * anonymous → "ẩn danh"
  * interviewee → "người được phỏng vấn"
  * straightforward → "trực tiếp", "đơn giản"
- Ví dụ:
  * EN: "Dave, I'm worried about our case study."
    VI: "Dave ơi, tôi lo lắng về nghiên cứu tình huống của chúng ta."
  * EN: "Okay. Well, it's quite straightforward."
    VI: "Được rồi. À, việc này khá trực tiếp." (❌ "Đấy. À mà, việc này rất đơn giản.")

【Ví dụ minh họa】(Phong cách đời thường):

1. You were joking?
   → Đùa à?

2. You were pulling my leg that whole time?
   → Bạn cứ trêu tôi à?

3. You.
   → Cậu đấy.

4. I can't believe it.
   → Tôi không tin nổi!

5. I got you, though. Didn't I?
   → Haha, trúng kế rồi! Có phải không?

6. Thanks for saying those nice things about me, though.
   → Cảm ơn đã nói những điều tốt về tôi.

7. It's nice to know what you think about me.
   → Biết bạn nghĩ gì về tôi, tôi vui lắm.

8. Especially that you think I'm good looking.
   → Đặc biệt là bạn còn nghĩ tôi đẹp trai.

9. The dog attacked you!
   → Chó đó vồ lấy cậu!

10. Oh no, that's terrible!
    → Trời ơi! Kinh khủng quá!

【Quy tắc theo loại】(QUAN TRỌNG - Phải tuân thủ):

a) 🎯 IELTS / Học thuật (IELTS / Academic):
   - ❌ TRÁNH hoàn toàn các từ thí mại: "đấy", "à mà", "nhỉ", "thế"
   - ❌ KHÔNG dùng từ lóng: "cậu", "tớ", "mình"
   - ✅ Dùng xưng hô trang trọng: "bạn", "chúng ta", "tôi"
   - ✅ Ngôn ngữ: chính xác, rõ ràng, trung tính
   - ✅ Thuật ngữ chuyên ngành:
     * case study → "nghiên cứu tình huống" (❌ "bài nghiên cứu")
     * interview → "phỏng vấn" (hỏi - đáp)
     * anonymous → "ẩn danh"
     * numerical data → "dữ liệu số"
     * findings → "kết quả nghiên cứu"
   - ✅ Giữ giọng văn học thuật nhưng tự nhiên

b) 📚 Khoa học (TED/Khoa học):
   - Thuật ngữ chính xác, không cảm xúc
   - Giải thích rõ ràng, dễ hiểu

c) 💼 Công sở (Formal):
   - Từ ngữ trang trọng, không dùng slang
   - Giọng văn trung tính, chuyên nghiệp

d) 🏠 Đời sống (Dialogue):
   - Dùng slang đời thường, phải có từ cảm xúc
   - Sử dụng "cậu", "tớ", thân mật

e) 💪 Truyền cảm hứng (Motivational):
   - Văn chương, ngắn gọn, từ ngữ đặc thù

【Định dạng输出】:
⚠️ Phải返回格式: {"translations": ["[Line 1] dịch 1", "[Line 2] dịch 2", ...]}
⚠️ Mỗi dịch phải保留 [Line N] tiền tố
⚠️ Nếu输入 4 câu, phải返回 4 dịch, không nhiều không ít!
❌ Tránh dùng ngoặc vuông [ ] trong nội dung dịch, chỉ保留 tiền tố [Line N]
"""

# ══════════════════════════════════════════════════════════════════════════════
# 数据完整性校验函数
# ══════════════════════════════════════════════════════════════════════════════

def validate_timestamps(transcript: List[Dict]) -> Tuple[bool, Optional[str]]:
    """时间戳合法性检查"""
    timestamps = []
    for sent in transcript:
        if 'start' in sent and 'end' in sent:
            timestamps.append((sent['start'], sent['end']))

    if len(timestamps) != len(transcript):
        return False, f"Số timestamp({len(timestamps)}) != số câu({len(transcript)})"

    for i, (start, end) in enumerate(timestamps):
        if start > end:
            return False, f"Câu {i+1} timestamp lộn: start({start}) > end({end})"

        if i < len(timestamps) - 1:
            next_start = timestamps[i + 1][0]
            if end > next_start:
                return False, f"Câu {i+1} và {i+2} chồng lấn: {end} > {next_start}"

    return True, None


def validate_alignment(source_count: int, translations: List[str]) -> bool:
    """强制对齐验证"""
    return len(translations) == source_count


def strip_line_prefix(translation: str) -> str:
    """清理 [Line N] 前缀"""
    match = re.match(r'\[Line \d+\]\s*', translation)
    if match:
        return translation[match.end():].strip()
    return translation.strip()


def translate_batch(texts: List[str], video_title: str, category: str, difficulty: str, strict_mode: bool = False) -> Optional[List[str]]:
    """批量翻译"""

    # 构建带 [Line N] 前缀的输入格式
    numbered_list = "\n".join([f"[Line {i+1}] {text}" for i, text in enumerate(texts)])

    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    if strict_mode:
        user_content = f"""⚠️ Chế độ nghiêm ngặt: phát hiện gộp câu, hãy dịch lại theo yêu cầu sau:

**[Tên video]: {video_title}**

**Phân loại**: {category}
**Độ khó**: {difficulty}

Nội dung phụ đề (có索引 [Line N]):
{numbered_list}

🚨 Yêu cầu căn chỉnh nghiêm ngặt:
1. Mỗi dòng [Line N] phải có dịch tương ứng, kể cả dịch tiếng Việt không hoàn chỉnh
2. Tránh gộp 2 dòng liền kề thành 1 dòng dịch
3. Định dạng trả về: mỗi dịch phải保留 tiền tố [Line N]

Ví dụ:
  [Line 1] Once upon a time,
  → [Line 1] Ngày xửa ngày xưa,

  [Line 2] in a land far away.
  → [Line 2] Ở một xứ sở xa xôi.

⚠️ Yêu cầu định dạng返回:
- Phải返回: {{"translations": ["[Line 1] dịch 1", "[Line 2] dịch 2", ...]}}
- Mỗi dịch phải保留 tiền tố [Line N]
- Số dòng phải bằng原文: {len(texts)} dòng
"""
    else:
        user_content = f"""Dịch {len(texts)} dòng phụ đề sau sang tiếng Việt:

**[Tên video]: {video_title}**
**Hãy dịch tự nhiên trong ngữ cảnh của video này, giữ一致 nội dung.**

**Phân loại**: {category}
**Độ khó**: {difficulty}

Nội dung phụ đề (có索引 [Line N]):
{numbered_list}

⚠️ Yêu cầu:
1. Tham khảo phong cách và句式 trong ví dụ
2. Dịch tự nhiên, đời thường, tránh sách giáo khoa

⚠️ QUAN TRỌNG - Theo loại素材:
"""

        # 根据分类添加特殊要求
        if "IELTS" in category or "Academic" in category or "Test" in video_title:
            user_content += """
🎯 IELTS / Academic素材特殊要求:
- ❌ KHÔNG dùng语气词: "đấy", "à mà", "nhỉ", "thì", "vậy"
- ❌ KHÔNG dùng thân mật xưng hô: "cậu", "tớ"
- ✅ Dùng trang trọng: "bạn", "chúng ta", "ông", "bà"
- ✅ case study → "nghiên cứu tình huống" (CHUẨN)
- ✅ interview → "phỏng vấn", findings → "kết quả nghiên cứu"
- ✅ Phong cách: học thuật, chính xác, trung tính
"""
        else:
            user_content += """
🏠 Đời sống / Dialogue素材:
- Dùng ngôn ngữ spoken, đời thường
- Sử dụng từ cảm xúc: à, mà, nhé, đấy
- Sử dụng xưng hô thân mật: cậu, tớ
"""

        user_content += f"""
⚠️ Yêu cầu định dạng返回:
- Phải返回: {{"translations": ["[Line 1] dịch 1", "[Line 2] dịch 2", ...]}}
- Mỗi dịch phải保留 tiền tố [Line N]
- Số dòng phải bằng原文: {len(texts)} dòng
"""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            data = json.loads(content)
            translations = data.get('translations', [])

            if not isinstance(translations, list):
                print(f"      ⚠️  Lỗi định dạng返回: không phải là mảng")
                return None

            if len(translations) != len(texts):
                print(f"      ⚠️  Số dòng返回 không khớp: {len(translations)}/{len(texts)}")
                return None

            cleaned_translations = []
            for trans in translations:
                cleaned = strip_line_prefix(trans)
                cleaned = cleaned.replace('[', '').replace(']', '')
                cleaned_translations.append(cleaned.strip())

            return cleaned_translations
        else:
            print(f"      ⚠️  API返回异常")
            return None

    except json.JSONDecodeError as e:
        print(f"      ❌ JSON解析失败: {str(e)[:50]}")
        return None
    except Exception as e:
        print(f"      ❌ Dịch thất bại: {str(e)[:50]}")
        return None


def process_material(material_id: str, video_title: str, category: str, difficulty: str, transcript: List[Dict], supabase_client) -> Dict:
    """处理单个素材的翻译"""

    print(f"\n{'─'*80}")
    print(f"🎬 {video_title}")
    print(f"📝 {len(transcript)} câu | 📂 {category} | 🎯 {difficulty}")
    print(f"{'─'*80}")

    valid_sentences = [(i, sent.get('text', '').strip()) for i, sent in enumerate(transcript) if sent.get('text', '').strip()]

    if not valid_sentences:
        print(f"❌ Không có câu hợp lệ")
        return {'success': False, 'reason': 'no_valid_sentences'}

    texts = [text for _, text in valid_sentences]
    batch_size = 4
    all_translations = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(texts) + batch_size - 1) // batch_size

        print(f"   📦 Batch {batch_num}/{total_batches} ({len(batch_texts)} câu)...", end="", flush=True)

        translations = None
        for retry in range(3):
            strict_mode = (retry > 0)
            translations = translate_batch(batch_texts, video_title, category, difficulty, strict_mode=strict_mode)

            if translations is None:
                if retry < 2:
                    mode_str = "chế độ nghiêm ngặt" if strict_mode else "chế độ thường"
                    print(f" [{mode_str} retry {retry+1}/2]...", end="", flush=True)
                    time.sleep(0.5)
                    continue
                else:
                    print(f" ❌ Căn chỉnh thất bại")
                    return {'success': False, 'reason': 'alignment_failed'}

            if validate_alignment(len(batch_texts), translations):
                break
            else:
                if retry < 2:
                    print(f" [căn chỉnh thất bại, retry nghiêm ngặt {retry+1}/2]...", end="", flush=True)
                    time.sleep(0.5)
                    translations = None
                    continue
                else:
                    print(f" ❌ Căn chỉnh thất bại")
                    return {'success': False, 'reason': 'alignment_failed'}

        all_translations.extend(translations)
        print(f" ✓")
        time.sleep(0.3)

    if len(all_translations) != len(texts):
        print(f"❌ Căn chỉnh cuối thất bại: {len(all_translations)}/{len(texts)}")
        return {'success': False, 'reason': 'final_alignment_failed'}

    # 更新 transcript（添加 translation_vi 字段）
    updated_transcript = []
    trans_idx = 0
    for sent in transcript:
        sent_copy = sent.copy()
        if sent.get('text', '').strip() and trans_idx < len(all_translations):
            # 保留原有的 translation，添加 translation_vi
            if 'translation' not in sent_copy:
                sent_copy['translation'] = {}
            sent_copy['translation']['vi'] = all_translations[trans_idx]
            trans_idx += 1
        updated_transcript.append(sent_copy)

    # 写入数据库
    try:
        supabase_client.table('materials').update({
            'transcript': updated_transcript
        }).eq('id', material_id).execute()

        print(f"✅ Hoàn thành")
        return {'success': True, 'reason': None}

    except Exception as e:
        print(f"❌ Cập nhật DB thất bại: {str(e)[:100]}")
        return {'success': False, 'reason': f'db_error: {str(e)[:50]}'}


def main():
    """主函数"""

    MODE = os.environ.get("MODE", "demo")  # demo | full | single
    SINGLE_ID = os.environ.get("SINGLE_ID")
    LIMIT = int(os.environ.get("LIMIT", "0"))

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("="*100)
    print("🌍 Tiếng Việt Translation Script V1.0 - Emotion & Natural Style")
    print("="*100)
    print(f"\n📋 Chế độ: {MODE}")

    stats = {
        'success': [],
        'failed': []
    }

    if MODE == "single":
        print(f"\n🎯 Material ID: {SINGLE_ID}")

        result = supabase.table('materials').select('*').eq('id', SINGLE_ID).execute()
        if not result.data:
            print(f"❌ Không tìm thấy material")
            return

        material = result.data[0]
        process_result = process_material(
            material['id'],
            material['title'],
            material['category'],
            material['difficulty'],
            material.get('transcript', []),
            supabase
        )

        if process_result['success']:
            stats['success'].append(material['title'])
        else:
            stats['failed'].append((material['title'], process_result['reason']))

    elif MODE == "demo":
        demo_titles = ["April Fool's Day Joke _ English Conversation"]
        print(f"\n🎯 Demo material: {len(demo_titles)} cái")

        for title in demo_titles:
            result = supabase.table('materials').select('*').eq('title', title).execute()
            if result.data:
                material = result.data[0]
                process_result = process_material(
                    material['id'],
                    material['title'],
                    material['category'],
                    material['difficulty'],
                    material.get('transcript', []),
                    supabase
                )

                if process_result['success']:
                    stats['success'].append(material['title'])
                else:
                    stats['failed'].append((material['title'], process_result['reason']))

    else:
        result = supabase.table('materials').select('*').order('id').execute()
        materials = result.data

        if LIMIT > 0:
            materials = materials[:LIMIT]
            print(f"\n📊 Giới hạn {LIMIT} material đầu")

        print(f"\n📊 Tổng material: {len(materials)}")

        for idx, material in enumerate(materials):
            current_num = idx + 1
            material_id = material['id']
            video_title = material['title']
            category = material['category']
            difficulty = material['difficulty']
            transcript = material.get('transcript', [])

            # 每 10 个提交一次
            if current_num % 10 == 1:
                print(f"\n{'='*100}")
                print(f"📦 Batch {((current_num-1)//10)+1} | Processing {current_num}-{min(current_num+9, len(materials))}")
                print(f"{'='*100}")

            process_result = process_material(
                material_id,
                video_title,
                category,
                difficulty,
                transcript,
                supabase
            )

            if process_result['success']:
                stats['success'].append(video_title)
            else:
                stats['failed'].append((video_title, process_result['reason']))

            # 每 10 个打印进度
            if current_num % 10 == 0 or current_num == len(materials):
                print(f"\n   📊 Progress: {current_num}/{len(materials)} | Success: {len(stats['success'])} | Failed: {len(stats['failed'])}")

    # 结果汇报
    print(f"\n{'='*100}")
    print(f"✅ Translation Task Complete")
    print(f"{'='*100}")

    print(f"\n📊 Statistics:")
    print(f"\n   ✅ Success: {len(stats['success'])} materials")
    print(f"   ❌ Failed: {len(stats['failed'])} materials")

    if stats['failed']:
        print(f"\n   Failed list:")
        for i, (title, reason) in enumerate(stats['failed'][:10], 1):
            print(f"      {i}. {title[:60]}")
            print(f"         Reason: {reason}")

    print(f"\n{'='*100}")


if __name__ == "__main__":
    main()
