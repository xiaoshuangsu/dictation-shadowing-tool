#!/usr/bin/env python3
"""
清理翻译中的 <translation_result> 标签
"""
import os
import sys
import time
from pathlib import Path
from supabase import create_client

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

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def clean_translation_tag(text: str) -> str:
    """清理 <translation_result> 标签"""
    if not isinstance(text, str):
        return text
    
    # 移除标签，保留内容
    if text.startswith('<translation_result>'):
        # 移除第一行的标签
        lines = text.split('\n')
        if lines[0].strip() == '<translation_result>':
            cleaned = '\n'.join(lines[1:]).strip()
            return cleaned
        else:
            # 移除标签部分
            cleaned = text.replace('<translation_result>', '').strip()
            return cleaned
    
    return text

def main():
    print("=" * 70)
    print("🧹 清理翻译格式标签")
    print("=" * 70)
    
    log("正在扫描需要清理的翻译...")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 查询所有素材
    result = supabase.table('materials').select('id, title, transcript').execute()
    
    materials_to_update = []
    total_issues = 0
    
    for material in result.data:
        transcript = material.get('transcript', [])
        modified = False
        issue_count = 0
        
        for sentence in transcript:
            translation = sentence.get('translation', {})
            if isinstance(translation, dict):
                for lang, trans_text in translation.items():
                    if isinstance(trans_text, str) and '<translation_result>' in trans_text:
                        # 清理标签
                        cleaned = clean_translation_tag(trans_text)
                        if cleaned != trans_text:
                            translation[lang] = cleaned
                            modified = True
                            issue_count += 1
        
        if modified:
            total_issues += issue_count
            materials_to_update.append({
                'id': material['id'],
                'title': material['title'],
                'transcript': transcript,
                'issue_count': issue_count
            })
    
    log(f"找到 {len(materials_to_update)} 个素材需要清理")
    log(f"总计 {total_issues} 个翻译需要清理")
    
    if not materials_to_update:
        log("\n✅ 没有发现需要清理的翻译")
        return
    
    # 批量更新
    log(f"\n开始清理...")
    success_count = 0
    
    for idx, material in enumerate(materials_to_update, 1):
        try:
            supabase.table('materials').update({
                'transcript': material['transcript']
            }).eq('id', material['id']).execute()
            
            success_count += material['issue_count']
            log(f"[{idx}/{len(materials_to_update)}] ✅ {material['title'][:50]} ({material['issue_count']} 条)")
            
            # 避免过快请求
            if idx % 10 == 0:
                time.sleep(0.5)
                
        except Exception as e:
            log(f"[{idx}/{len(materials_to_update)}] ❌ {material['title'][:50]} - {e}")
    
    print("\n" + "=" * 70)
    print("✅ 清理完成")
    print("=" * 70)
    print(f"\n📊 最终结果：")
    print(f"   成功清理: {success_count} 条翻译")
    print(f"   涉及素材: {len(materials_to_update)} 个")
    print("=" * 70)

if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
