#!/usr/bin/env python3
"""
优化单词听写挖空逻辑

功能：
1. 加载核心英语词汇列表（Oxford 3000）
2. 扫描数据库中所有素材的 transcript
3. 使用 NLTK 智能识别动词、名词、形容词
4. 优先选择核心词汇中的"实词"作为挖空对象
5. 排除简单词（a, an, the, I, you, he 等）
6. 更新 transcript 的 blanks 字段

作者: Claude
日期: 2026-03-19
"""

import os
import sys
import json
import random
import argparse
from typing import List, Dict, Any, Tuple, Set
from dataclasses import dataclass
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client

# ============ 配置 ============
# 尝试加载多个可能的 .env 文件
load_dotenv('.env.local')  # 优先从项目根目录加载 .env.local
load_dotenv()  # 再尝试加载默认的 .env

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

# 停用词列表（过于简单的词，不作为挖空对象）
STOP_WORDS = {
    # 冠词
    'a', 'an', 'the',
    # 代词
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their',
    'this', 'that', 'these', 'those',
    # 介词
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
    # 连词
    'and', 'but', 'or', 'so', 'because',
    # 助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'let',  # Let's 中的 let（语法结构词）
    # 其他
    'yes', 'no', 'not', 'oh', 'hey', 'well', 'now', 'then', 'here', 'there',
    'what', 'when', 'where', 'who', 'why', 'how',
    # 常用副词和程度词
    'very', 'really', 'quite', 'rather', 'too', 'also', 'just', 'only', 'still', 'already'
}

# 礼貌套话和固定表达（这些句子中的词不挖空）
EXCLUDE_PHRASES = {
    'thank', 'thanks', 'hello', 'hi', 'hey',
    'sorry', 'excuse', 'forgive', 'pardon',
    'bye', 'goodbye', 'farewell',
    'bless', 'cheers', 'greetings',
    'welcome', 'congratulations', 'congrats'
}

# ============ 白名单：允许挖空的词 ============
# 实义代词（不定代词，有实际意义）
MEANINGFUL_PRONOUNS = {
    'everything', 'something', 'anything', 'nothing',
    'everyone', 'someone', 'anyone', 'noone', 'nobody', 'everyone',
    'everybody', 'somebody', 'anybody', 'everybody',
    'one', 'none', 'all', 'some', 'any', 'most', 'few'
}

# 实义缩写词（有实际意义，允许挖空）
MEANINGFUL_CONTRACTIONS = {
    "o'clock",  # 时间表达
    'yesterday', 'today', 'tomorrow'  # 虽然可能有缩写，但保留
}

# ============ 黑名单：禁止挖空的缩写词 ============
FORBIDDEN_CONTRACTIONS = {
    # 代词 + 系动词组合（正则：^[A-Za-z]+'s$）
    "that's", "it's", "he's", "she's", "we're", "they're",
    "that'll", "it'll", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
    "that'd", "it'd", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
    "that're", "this's", "these're", "those're",

    # 代词 + 助动词组合（正则：^[A-Za-z]+'m$）
    "i'm", "you're", "we're", "they're", "he's", "she's", "it's",

    # 助动词 + not 缩写（正则：^[A-Za-z]+n't$）
    "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't",
    "can't", "couldn't", "shouldn't", "wouldn't", "won't", "mightn't", "mustn't",
    "haven't", "hasn't", "hadn't"
}

# ============ 专有名词识别 ============
# 常见英美人名列表（约 200 个）
COMMON_NAMES = {
    # 男性名字
    'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles',
    'christopher', 'daniel', 'matthew', 'anthony', 'donald', 'mark', 'paul', 'steven', 'andrew', 'kenneth',
    'joshua', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
    'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
    'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',

    # 女性名字
    'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
    'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
    'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
    'kathleen', 'amy', 'shirley', 'angela', 'helen', 'anna', 'brenda', 'pamela', 'emma', 'nicole',
    'hannah', 'samantha', 'katherine', 'christine', 'debra', 'rachel', 'catherine', 'carolyn', 'janet', 'ruth',

    # 常见名字变体
    'kate', 'katie', 'lizzy', 'liz', 'beth', 'becky', 'sue', 'maggie', 'meg', 'annie',
    'abby', 'cathy', 'chrissy', 'debbie', 'gina', 'jenny', 'kathy', 'missy', 'molly', 'patty',
    'bob', 'bill', 'jim', 'joe', 'tom', 'tim', 'tony', 'mike', 'rick', 'steve',
    'dan', 'dave', 'greg', 'jeff', 'johnny', 'kenny', 'pete', 'phil', 'ron', 'rob',

    # 常见姓氏
    'smith', 'jones', 'williams', 'brown', 'davis', 'miller', 'wilson', 'moore', 'taylor', 'anderson',
    'thomas', 'jackson', 'white', 'harris', 'martin', 'thompson', 'garcia', 'martinez', 'robinson', 'clark'
}

def is_proper_noun(word: str, pos: str, word_index: int, sentence_length: int) -> bool:
    """判断是否为专有名词

    Args:
        word: 单词
        pos: 词性标注
        word_index: 单词在句子中的位置
        sentence_length: 句子总词数

    Returns:
        是否为专有名词
    """
    # 1. 词性标注判断（最可靠）
    if pos in ['NNP', 'NNPS']:
        return True

    # 2. 常用人名判断
    if word.lower() in COMMON_NAMES:
        return True

    # 3. 首字母大写且不在句首的名词
    # 注意：只有名词（NN, NNS）才可能是因为专有名词而大写
    # 形容词、动词等的大写通常是其他原因（如句首、强调等）
    pos_category = pos[:2]
    if word_index > 0 and word[0].isupper() and word.isalpha() and pos_category in ['NN', 'NNS']:
        return True

    return False

# 核心词汇集合（Oxford 3000 的子集，按词频排序）
# 这个列表会在运行时从网络或本地文件加载
CORE_VOCABULARY: Set[str] = set()

# ============ NLTK 初始化 ============
def setup_nltk():
    """初始化 NLTK 并下载必要的数据"""
    try:
        import nltk
        print("📦 NLTK 已安装")

        # 下载必要的数据包
        required_packages = ['punkt', 'averaged_perceptron_tagger']
        optional_packages = ['punkt_tab', 'averaged_perceptron_tagger_eng', 'punkt_eng']

        for package in required_packages:
            try:
                nltk.data.find(f'tokenizers/{package}')
            except LookupError:
                try:
                    nltk.data.find(f'taggers/{package}')
                except LookupError:
                    nltk.download(package, quiet=True)

        # 尝试下载可选数据包（忽略失败）
        for package in optional_packages:
            try:
                nltk.download(package, quiet=True)
            except:
                pass

        return True
    except ImportError:
        print("❌ NLTK 未安装")
        print("   请运行: pip install nltk")
        return False

# ============ 核心词汇加载 ============
def load_core_vocabulary() -> Set[str]:
    """加载核心英语词汇列表（Oxford 3000）"""
    global CORE_VOCABULARY

    # 尝试从本地缓存加载
    cache_file = os.path.join(os.path.dirname(__file__), '.core_vocab_cache.json')
    if os.path.exists(cache_file):
        print(f"📂 从本地缓存加载核心词汇: {cache_file}")
        with open(cache_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            CORE_VOCABULARY = set(data.get('words', []))
            print(f"✅ 已加载 {len(CORE_VOCABULARY)} 个核心词汇")
            return CORE_VOCABULARY

    # 内置核心词汇（Oxford 3000，约 2000 词）
    # 按词频和重要性排序
    core_words = [
        # ========== 动词 (500) ==========
        # 最常用动词
        'be', 'have', 'do', 'say', 'go', 'get', 'make', 'see', 'know', 'think',
        'take', 'come', 'give', 'want', 'use', 'find', 'tell', 'ask', 'work', 'seem',
        'feel', 'try', 'leave', 'call', 'keep', 'let', 'become', 'show', 'play', 'run',
        'move', 'live', 'believe', 'bring', 'happen', 'write', 'sit', 'stand', 'lose', 'pay',
        'meet', 'include', 'continue', 'set', 'change', 'lead', 'understand', 'watch', 'follow', 'stop',
        'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk', 'win',
        'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send',
        'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain', 'suggest', 'raise',
        'pass', 'sell', 'require', 'report', 'decide', 'pull', 'break', 'receive', 'join', 'catch',

        # 情绪和表达动词
        'miss', 'wish', 'hope', 'care', 'mind', 'enjoy', 'like', 'love', 'hate', 'fear',
        'worry', 'panic', 'scream', 'shout', 'cry', 'laugh', 'smile', 'dance', 'sing', 'dream',
        'imagine', 'believe', 'trust', 'doubt', 'realize', 'notice', 'recognize', 'remember', 'forget', 'learn',
        'study', 'teach', 'train', 'practice', 'improve', 'develop', 'achieve', 'succeed', 'fail', 'attempt',

        # 日常活动动词
        'eat', 'drink', 'sleep', 'wake', 'wash', 'clean', 'cook', 'bake', 'taste', 'smell',
        'listen', 'look', 'watch', 'stare', 'observe', 'notice', 'check', 'test', 'examine', 'search',
        'drive', 'ride', 'fly', 'travel', 'visit', 'explore', 'discover', 'arrive', 'depart', 'return',
        'start', 'begin', 'end', 'finish', 'complete', 'continue', 'pause', 'stop', 'wait', 'stay',

        # 交流和社交动词
        'talk', 'speak', 'tell', 'say', 'ask', 'answer', 'reply', 'explain', 'describe', 'discuss',
        'argue', 'debate', 'agree', 'disagree', 'promise', 'apologize', 'forgive', 'thank', 'invite', 'welcome',
        'introduce', 'present', 'represent', 'announce', 'declare', 'state', 'claim', 'mention', 'note', 'remark',

        # 工作和商务动词
        'work', 'employ', 'manage', 'lead', 'direct', 'control', 'supervise', 'organize', 'plan', 'prepare',
        'produce', 'manufacture', 'construct', 'build', 'create', 'design', 'invent', 'develop', 'improve', 'maintain',
        'sell', 'buy', 'purchase', 'trade', 'exchange', 'market', 'advertise', 'promote', 'launch', 'release',
        'earn', 'spend', 'save', 'invest', 'borrow', 'lend', 'owe', 'pay', 'afford', 'cost',

        # 思维和认知动词
        'think', 'consider', 'ponder', 'reflect', 'analyze', 'evaluate', 'assess', 'judge', 'conclude', 'decide',
        'choose', 'select', 'pick', 'prefer', 'reject', 'accept', 'approve', 'support', 'oppose', 'resist',
        'understand', 'comprehend', 'realize', 'recognize', 'know', 'learn', 'remember', 'forget', 'recall', 'imagine',

        # 变化和影响动词
        'change', 'transform', 'convert', 'alter', 'modify', 'adjust', 'adapt', 'evolve', 'develop', 'grow',
        'increase', 'decrease', 'raise', 'lower', 'expand', 'reduce', 'improve', 'worsen', 'enhance', 'decline',
        'affect', 'influence', 'impact', 'shape', 'determine', 'control', 'direct', 'guide', 'lead', 'manage',

        # 运动和位置动词
        'go', 'come', 'arrive', 'depart', 'leave', 'return', 'enter', 'exit', 'approach', 'reach',
        'move', 'shift', 'transfer', 'transport', 'carry', 'bring', 'take', 'fetch', 'deliver', 'send',
        'put', 'place', 'set', 'lay', 'stand', 'sit', 'lie', 'hang', 'attach', 'connect',

        # 状态和存在动词
        'be', 'exist', 'live', 'survive', 'die', 'remain', 'stay', 'continue', 'last', 'endure',
        'appear', 'seem', 'look', 'sound', 'feel', 'smell', 'taste', 'become', 'turn', 'grow',

        # ========== 名词 (800) ==========
        # 时间和空间
        'time', 'moment', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century',
        'past', 'present', 'future', 'history', 'period', 'era', 'age', 'schedule', 'deadline', 'date',
        'space', 'place', 'area', 'region', 'zone', 'location', 'position', 'spot', 'point', 'site',
        'world', 'earth', 'universe', 'nature', 'environment', 'surroundings', 'atmosphere', 'climate', 'weather', 'temperature',

        # 人物和身份
        'person', 'people', 'human', 'individual', 'man', 'woman', 'child', 'boy', 'girl', 'kid',
        'family', 'parent', 'father', 'mother', 'brother', 'sister', 'son', 'daughter', 'child', 'baby',
        'friend', 'companion', 'partner', 'colleague', 'neighbor', 'stranger', 'enemy', 'rival', 'opponent', 'competitor',
        'teacher', 'student', 'doctor', 'nurse', 'police', 'lawyer', 'engineer', 'artist', 'musician', 'writer',

        # 社会和机构
        'society', 'community', 'culture', 'civilization', 'nation', 'country', 'state', 'city', 'town', 'village',
        'government', 'politics', 'democracy', 'republic', 'monarchy', 'kingdom', 'empire', 'dynasty', 'regime', 'administration',
        'company', 'business', 'corporation', 'organization', 'institution', 'association', 'foundation', 'institute', 'agency', 'bureau',
        'school', 'university', 'college', 'academy', 'library', 'museum', 'hospital', 'clinic', 'bank', 'store',

        # 抽象概念
        'idea', 'concept', 'thought', 'notion', 'belief', 'opinion', 'view', 'perspective', 'attitude', 'approach',
        'theory', 'hypothesis', 'principle', 'rule', 'law', 'regulation', 'policy', 'guideline', 'standard', 'criterion',
        'fact', 'truth', 'reality', 'knowledge', 'information', 'data', 'evidence', 'proof', 'argument', 'case',
        'problem', 'issue', 'challenge', 'difficulty', 'trouble', 'crisis', 'emergency', 'disaster', 'catastrophe', 'tragedy',
        'solution', 'answer', 'result', 'outcome', 'consequence', 'effect', 'impact', 'influence', 'change', 'development',
        'goal', 'objective', 'aim', 'purpose', 'target', 'ambition', 'dream', 'wish', 'desire', 'hope',

        # 日常生活
        'house', 'home', 'room', 'kitchen', 'bedroom', 'bathroom', 'living', 'office', 'desk', 'chair',
        'food', 'meal', 'breakfast', 'lunch', 'dinner', 'dish', 'cuisine', 'restaurant', 'cafe', 'bar',
        'clothes', 'clothing', 'shirt', 'pants', 'dress', 'shoes', 'hat', 'coat', 'jacket', 'uniform',
        'money', 'cash', 'currency', 'dollar', 'euro', 'pound', 'cent', 'coin', 'bill', 'check',
        'phone', 'mobile', 'computer', 'laptop', 'tablet', 'internet', 'email', 'message', 'letter', 'post',

        # 工具和设备
        'tool', 'instrument', 'device', 'machine', 'engine', 'motor', 'vehicle', 'car', 'bus', 'train',
        'plane', 'boat', 'ship', 'bicycle', 'motorcycle', 'truck', 'van', 'taxi', 'subway', 'metro',
        'book', 'paper', 'pen', 'pencil', 'notebook', 'document', 'file', 'folder', 'report', 'article',

        # 身体和健康
        'body', 'head', 'face', 'eye', 'ear', 'nose', 'mouth', 'hand', 'arm', 'leg',
        'foot', 'finger', 'toe', 'hair', 'skin', 'bone', 'muscle', 'blood', 'heart', 'brain',
        'health', 'medicine', 'doctor', 'hospital', 'disease', 'illness', 'sickness', 'pain', 'ache', 'fever',
        'treatment', 'cure', 'therapy', 'surgery', 'operation', 'recovery', 'healing', 'death', 'life', 'birth',

        # 情感和品质
        'love', 'hate', 'anger', 'fear', 'joy', 'happiness', 'sadness', 'pleasure', 'pain', 'suffering',
        'hope', 'dream', 'wish', 'desire', 'passion', 'emotion', 'feeling', 'mood', 'spirit', 'soul',
        'courage', 'strength', 'power', 'weakness', 'confidence', 'doubt', 'faith', 'trust', 'belief', 'hope',
        'beauty', 'ugliness', 'goodness', 'evil', 'truth', 'lie', 'honesty', 'dishonesty', 'kindness', 'cruelty',

        # 科学和技术
        'science', 'technology', 'research', 'experiment', 'discovery', 'invention', 'innovation', 'progress', 'development', 'advancement',
        'physics', 'chemistry', 'biology', 'mathematics', 'geometry', 'algebra', 'statistics', 'probability', 'logic', 'reason',
        'energy', 'power', 'electricity', 'electronics', 'mechanics', 'engineering', 'software', 'hardware', 'system', 'network',
        'internet', 'web', 'site', 'page', 'link', 'connection', 'signal', 'message', 'code', 'program',

        # 艺术和媒体
        'art', 'music', 'song', 'dance', 'painting', 'drawing', 'sculpture', 'film', 'movie', 'video',
        'photo', 'picture', 'image', 'story', 'novel', 'poem', 'poetry', 'literature', 'book', 'magazine',
        'news', 'media', 'television', 'radio', 'newspaper', 'journal', 'report', 'article', 'blog', 'website',
        'theater', 'cinema', 'concert', 'performance', 'show', 'exhibition', 'gallery', 'museum', 'festival', 'celebration',

        # 自然和地理
        'nature', 'world', 'earth', 'planet', 'star', 'sun', 'moon', 'sky', 'cloud', 'rain',
        'snow', 'wind', 'storm', 'thunder', 'lightning', 'fog', 'mist', 'ice', 'water', 'fire',
        'mountain', 'hill', 'valley', 'river', 'lake', 'sea', 'ocean', 'beach', 'coast', 'shore',
        'forest', 'tree', 'plant', 'flower', 'grass', 'field', 'garden', 'park', 'desert', 'island',
        'animal', 'bird', 'fish', 'dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'chicken',

        # 运动和娱乐
        'sport', 'game', 'match', 'competition', 'contest', 'tournament', 'championship', 'league', 'team', 'player',
        'football', 'basketball', 'tennis', 'golf', 'swimming', 'running', 'athletics', 'gymnastics', 'boxing', 'wrestling',
        'music', 'band', 'orchestra', 'choir', 'singer', 'musician', 'composer', 'song', 'melody', 'rhythm',
        'hobby', 'interest', 'passion', 'activity', 'entertainment', 'fun', 'enjoyment', 'pleasure', 'leisure', 'vacation',

        # ========== 形容词 (500) ==========
        # 大小和数量
        'big', 'large', 'huge', 'enormous', 'giant', 'massive', 'small', 'little', 'tiny', 'miniature',
        'long', 'short', 'tall', 'high', 'low', 'deep', 'shallow', 'wide', 'narrow', 'thick',
        'thin', 'heavy', 'light', 'strong', 'weak', 'hard', 'soft', 'rough', 'smooth', 'sharp',
        'many', 'much', 'few', 'little', 'some', 'any', 'all', 'every', 'each', 'none',
        'enough', 'plenty', 'lots', 'more', 'most', 'less', 'least', 'multiple', 'single', 'double',

        # 质量和评价
        'good', 'great', 'excellent', 'perfect', 'wonderful', 'amazing', 'awesome', 'fantastic', 'terrific', 'superb',
        'bad', 'poor', 'terrible', 'awful', 'horrible', 'dreadful', 'disgusting', 'nasty', 'lousy', 'worst',
        'nice', 'kind', 'friendly', 'pleasant', 'agreeable', 'delightful', 'enjoyable', 'satisfying', 'pleasing', 'lovely',
        'mean', 'cruel', 'harsh', 'rough', 'tough', 'severe', 'strict', 'stern', 'firm', 'strong',

        # 重要性和优先级
        'important', 'significant', 'major', 'minor', 'essential', 'crucial', 'critical', 'vital', 'key', 'main',
        'primary', 'secondary', 'central', 'basic', 'fundamental', 'core', 'basic', 'simple', 'complex', 'complicated',
        'urgent', 'pressing', 'immediate', 'quick', 'rapid', 'fast', 'slow', 'gradual', 'steady', 'stable',

        # 新旧和时间
        'new', 'young', 'fresh', 'modern', 'current', 'recent', 'latest', 'present', 'contemporary', 'up-to-date',
        'old', 'ancient', 'antique', 'aged', 'elderly', 'past', 'previous', 'former', 'earlier', 'original',
        'early', 'late', 'early', ' timely', 'punctual', 'prompt', 'quick', 'rapid', 'swift', 'speedy',

        # 美丑和外观
        'beautiful', 'pretty', 'attractive', 'gorgeous', 'handsome', 'good-looking', 'stunning', 'lovely', 'cute', 'charming',
        'ugly', 'hideous', 'unattractive', 'plain', 'ordinary', 'average', 'common', 'typical', 'normal', 'regular',
        'clean', 'dirty', 'messy', 'tidy', 'neat', 'bright', 'dark', 'light', 'colorful', 'colorless',

        # 情感和态度
        'happy', 'glad', 'pleased', 'delighted', 'satisfied', 'content', 'joyful', 'cheerful', 'excited', 'thrilled',
        'sad', 'unhappy', 'miserable', 'depressed', 'upset', 'disappointed', 'worried', 'anxious', 'nervous', 'stressed',
        'angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated', 'upset', 'disturbed', 'concerned', 'troubled',
        'afraid', 'scared', 'frightened', 'terrified', 'shocked', 'surprised', 'amazed', 'astonished', 'stunned', 'speechless',
        'calm', 'relaxed', 'peaceful', 'quiet', 'silent', 'still', 'noisy', 'loud', 'busy', 'active',

        # 智力和能力
        'smart', 'intelligent', 'clever', 'bright', 'brilliant', 'genius', 'wise', 'stupid', 'dumb', 'foolish',
        'able', 'capable', 'competent', 'skilled', 'talented', 'gifted', 'expert', 'experienced', 'qualified', 'trained',
        'useful', 'helpful', 'practical', 'effective', 'efficient', 'successful', 'productive', 'powerful', 'strong', 'weak',
        'possible', 'impossible', 'probable', 'likely', 'unlikely', 'certain', 'sure', 'confident', 'aware', 'conscious',

        # 真假和确定性
        'true', 'real', 'actual', 'genuine', 'authentic', 'false', 'fake', 'artificial', 'unreal', 'imaginary',
        'right', 'wrong', 'correct', 'incorrect', 'accurate', 'inaccurate', 'exact', 'precise', 'approximate', 'rough',
        'clear', 'obvious', 'evident', 'apparent', 'certain', 'sure', 'confident', 'doubtful', 'uncertain', 'unsure',
        'honest', 'dishonest', 'truthful', 'deceitful', 'sincere', 'genuine', 'fake', 'false', 'true', 'real',

        # 开闭和状态
        'open', 'closed', 'shut', 'locked', 'unlocked', 'free', 'occupied', 'available', 'unavailable', 'accessible',
        'full', 'empty', 'vacant', 'blank', 'complete', 'incomplete', 'finished', 'unfinished', 'done', 'undone',
        'ready', 'prepared', 'set', 'fixed', 'stable', 'steady', 'secure', 'safe', 'dangerous', 'risky',

        # 社会和政治
        'public', 'private', 'personal', 'individual', 'collective', 'social', 'cultural', 'political', 'economic', 'financial',
        'national', 'international', 'global', 'worldwide', 'local', 'regional', 'urban', 'rural', 'suburban', 'remote',
        'democratic', 'republican', 'liberal', 'conservative', 'radical', 'moderate', 'extreme', 'moderate', 'neutral', 'independent',

        # 难易和复杂度
        'easy', 'simple', 'difficult', 'hard', 'tough', 'challenging', 'demanding', 'complex', 'complicated', 'sophisticated',
        'basic', 'elementary', 'advanced', 'expert', 'professional', 'amateur', 'beginner', 'novice', 'experienced', 'inexperienced',

        # ========== 副词 (200) ==========
        # 时间
        'now', 'then', 'today', 'tomorrow', 'yesterday', 'soon', 'later', 'earlier', 'before', 'after',
        'always', 'never', 'often', 'sometimes', 'rarely', 'seldom', 'usually', 'normally', 'generally', 'frequently',
        'already', 'yet', 'still', 'just', 'recently', 'lately', 'currently', 'presently', 'briefly', 'momentarily',

        # 程度和方式
        'very', 'extremely', 'incredibly', 'absolutely', 'completely', 'totally', 'entirely', 'fully', 'quite', 'rather',
        'fairly', 'pretty', 'somewhat', 'slightly', 'hardly', 'barely', 'scarcely', 'almost', 'nearly', 'approximately',
        'exactly', 'precisely', 'accurately', 'correctly', 'rightly', 'wrongly', 'properly', 'appropriately', 'suitably', 'fittingly',

        # 方向和位置
        'here', 'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere', 'inside', 'outside', 'indoors', 'outdoors',
        'up', 'down', 'upstairs', 'downstairs', 'above', 'below', 'over', 'under', 'around', 'round',
        'back', 'forward', 'backward', 'sideways', 'across', 'through', 'along', 'past', 'beyond', 'behind',

        # 肯定和否定
        'yes', 'no', 'certainly', 'definitely', 'surely', 'absolutely', 'positively', 'undoubtedly', 'clearly', 'obviously',
        'not', 'never', 'no', 'neither', 'nor', 'hardly', 'barely', 'scarcely', 'rarely', 'seldom',

        # 语气和态度
        'fortunately', 'unfortunately', 'luckily', 'sadly', 'happily', 'ironically', 'surprisingly', 'shockingly', 'amazingly', 'incredibly',
        'hopefully', 'ideally', 'technically', 'theoretically', 'practically', 'basically', 'essentially', 'fundamentally', 'ultimately', 'finally',

        # 方式和方法
        'quickly', 'rapidly', 'swiftly', 'slowly', 'gradually', 'steadily', 'carefully', 'carelessly', 'cautiously', 'recklessly',
        'easily', 'effortlessly', 'hardly', 'with difficulty', 'simply', 'merely', 'barely', 'just', 'only', 'alone',

        # 因果和逻辑
        'therefore', 'thus', 'hence', 'consequently', 'accordingly', 'so', 'then', 'thereby', 'therefore', 'because',
        'however', 'nevertheless', 'nonetheless', 'still', 'yet', 'though', 'although', 'even', 'despite', 'instead',
    ]

    CORE_VOCABULARY = set(word.lower() for word in core_words)

    # 保存到缓存
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({'words': list(CORE_VOCABULARY)}, f, ensure_ascii=False, indent=2)
        print(f"💾 已缓存 {len(CORE_VOCABULARY)} 个核心词汇")
    except Exception as e:
        print(f"⚠️  无法保存缓存: {e}")

    print(f"✅ 已加载 {len(CORE_VOCABULARY)} 个核心词汇（内置）")
    return CORE_VOCABULARY

# ============ 词形归一化 ============
def normalize_word(word: str) -> str:
    """将单词归一化为基本形式

    简单的词形归一化（处理常见复数和动词形式）：
    - clouds → cloud
    - cities → city
    - babies → baby
    - crying → cry
    - running → run
    - making → make
    """
    word_lower = word.lower()

    # 处理 -ing 形式（动词现在分词）
    if word_lower.endswith('ing') and len(word_lower) > 5:
        base = word_lower[:-3]  # 去掉 -ing

        # 情况1: 去掉 -ing 后双写结尾字母（running → runn → run）
        if len(base) >= 2 and base[-1] == base[-2]:
            return base[:-1]

        # 情况2: 以辅音字母结尾的短词，可能需要加 e（making → mak → make）
        # 但要排除以 y 结尾的词（crying → cry）
        if len(base) <= 4 and not base.endswith(('a', 'e', 'i', 'o', 'u', 'y')):
            return base + 'e'

        # 情况3: 直接去掉 -ing（crying → cry）
        return base

    # 处理 -ies 结尾（如：cities → city, babies → baby）
    if word_lower.endswith('ies'):
        return word_lower[:-3] + 'y'

    # 处理 -es 结尾（如：boxes → box）
    if word_lower.endswith('es') and len(word_lower) > 3:
        # 排除 -ss, -ch, -sh, -x 结尾的复数形式
        if not (word_lower.endswith('sses') or word_lower.endswith('ches') or word_lower.endswith('shes')):
            return word_lower[:-2]

    # 处理 -s 结尾（如：clouds → cloud）
    if word_lower.endswith('s') and len(word_lower) > 2:
        return word_lower[:-1]

    return word_lower

# ============ 词性分析 ============
def analyze_sentence_words(sentence: str) -> List[Tuple[str, str]]:
    """分析句子中的单词及其词性

    返回: [(word, pos_tag), ...]
    """
    import nltk

    # 分词
    tokens = nltk.word_tokenize(sentence)

    # 词性标注
    pos_tags = nltk.pos_tag(tokens)

    return pos_tags

def select_best_blank(
    words_with_pos: List[Tuple[str, str]],
    word_indices: List[int],
    sentence_text: str
) -> Dict[str, Any]:
    """选择最适合挖空的单词

    优先级：
    1. 核心词汇中的实词（动词、名词、形容词）
    2. 排除停用词和礼貌套话
    3. 优先选择有意义的词汇
    4. 短句（3-5词）：必须挖空核心实词，严禁挖空无意义词汇

    返回: {
        'word': 'selected_word',
        'index': 5,
        'pos': 'VB',
        'is_core': True,
        'reason': '...'
    }
    """
    # 判断句子长度（单词数量）
    actual_words = [w for w, p in words_with_pos if w.isalpha()]
    sentence_length = len(actual_words)
    is_short_sentence = 3 <= sentence_length <= 5

    # 过滤停用词后的候选词
    candidates = []

    for i, (word, pos) in enumerate(words_with_pos):
        original_word = word

        # 规范化单词（小写，去除标点）
        word_clean = word.lower().replace('.', '').replace(',', '').replace('!', '').replace('?', '').replace("'", '')

        # 跳过停用词
        if word_clean in STOP_WORDS:
            continue

        # 跳过礼貌套话和固定表达
        if word_clean in EXCLUDE_PHRASES:
            continue

        # ⛔ 黑名单：禁止挖空的缩写词（That's, It's, I'm, You're等）
        word_normalized = word.lower().replace("'", "").replace(".", "")
        if word_normalized in FORBIDDEN_CONTRACTIONS:
            continue

        # ⛔ 专有名词排除（人名、地名等）
        if is_proper_noun(word, pos, i, len(words_with_pos)):
            continue

        # 跳过非字母词（数字、标点等）
        # 但允许缩写词中的撇号
        if not word_clean.replace("'", "").replace(".", "").isalpha() or len(word_clean) < 2:
            # 特殊处理：允许 o'clock 等实义缩写
            if word not in MEANINGFUL_CONTRACTIONS:
                continue

        # 获取词性大类
        pos_category = pos[:2]  # NN=名词, VB=动词, JJ=形容词, RB=副词

        # 判断是否为核心词汇（使用词形归一化）
        word_normalized = normalize_word(word_clean)
        is_core = word_normalized in CORE_VOCABULARY or word_clean in CORE_VOCABULARY

        # 短句特殊处理：必须挖空核心实词（动词、名词、形容词）
        if is_short_sentence:
            # 短句中，只考虑实词
            if pos_category not in ['NN', 'VB', 'JJ', 'VBP', 'VBZ', 'VBD', 'VBG', 'VBN', 'NNS', 'NNP']:
                continue

            # ⭐ 保底机制：如果都不是核心词汇，也允许实义动词和普通名词
            # 这样可以避免像 "How can I help you?" 这样的句子完全没有词可挖
            if not is_core and pos_category not in ['VB', 'NN']:
                # 非核心动词和名词仍然可以考虑，只是得分会低一些
                continue

        # 计算得分
        score = 0
        reason = []

        # ⭐ 白名单加分：不定代词（everything, nothing等）
        if word_clean in MEANINGFUL_PRONOUNS:
            score += 25
            reason.append('meaningful_pronoun')

        # ⭐ 白名单加分：实义缩写（o'clock等）
        if word in MEANINGFUL_CONTRACTIONS:
            score += 20
            reason.append('meaningful_contraction')

        # 核心词汇加分（短句中权重更高）
        if is_core:
            score += 50 if not is_short_sentence else 70
            reason.append('core_word')

        # 实词加分
        if pos_category in ['NN', 'VB', 'JJ']:
            score += 30
            reason.append('content_word')

        # 动词、名词、形容词优先级（保持原有优先级：动词 > 名词 > 形容词）
        if pos_category in ['VB', 'VBP', 'VBZ', 'VBD', 'VBG', 'VBN']:
            score += 20
            reason.append('verb')
        elif pos_category in ['NN', 'NNS', 'NNP']:
            score += 15
            reason.append('noun')
        elif pos_category in ['JJ', 'JJR', 'JJS']:
            score += 10
            reason.append('adjective')

        # 数词加分（保底机制）
        if pos_category == 'CD':
            score += 8
            reason.append('number')

        # 短句额外加分
        if is_short_sentence:
            score += 30
            reason.append('short_sentence_key_word')

        # 单词长度适中（3-10个字母）
        if 3 <= len(word_clean) <= 10:
            score += 5
            reason.append('good_length')

        # 添加随机性（避免总是选择同一个词）
        score += random.uniform(0, 5)

        candidates.append({
            'word': original_word,
            'word_clean': word_clean,
            'index': i,
            'pos': pos,
            'pos_category': pos_category,
            'is_core': is_core,
            'score': score,
            'reason': ', '.join(reason)
        })

    # 如果没有候选词，返回空
    if not candidates:
        return {}

    # 按得分排序
    candidates.sort(key=lambda x: x['score'], reverse=True)

    # 返回得分最高的
    best = candidates[0]
    return {
        'word': best['word'],
        'index': best['index'],
        'pos': best['pos'],
        'is_core': best['is_core'],
        'score': best['score'],
        'reason': best['reason']
    }

# ============ 数据库操作 ============
def get_all_materials(client, slug: str = None):
    """获取所有素材或指定 slug 的单个素材"""
    if slug:
        print(f"📥 获取素材 (slug: {slug})...")
        result = client.table('materials').select('id, title, slug, transcript').eq('slug', slug).execute()
    else:
        print("📥 获取所有素材...")
        result = client.table('materials').select('id, title, slug, transcript').execute()

    if not result.data:
        print("❌ 没有找到素材")
        return []

    print(f"✅ 找到 {len(result.data)} 个素材")
    return result.data

def save_checkpoint(last_id: str, batch_num: int, stats: dict):
    """保存断点记录"""
    checkpoint_file = os.path.join(os.path.dirname(__file__), '.improve_blanks_checkpoint.json')
    with open(checkpoint_file, 'w', encoding='utf-8') as f:
        json.dump({
            'last_id': last_id,
            'batch_num': batch_num,
            'timestamp': json.dumps(datetime.now().isoformat()),
            'stats': stats
        }, f, indent=2)

def load_checkpoint():
    """加载断点记录"""
    checkpoint_file = os.path.join(os.path.dirname(__file__), '.improve_blanks_checkpoint.json')
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_report(stats: dict, total_batches: int, errors: list):
    """保存处理报告"""
    report_file = os.path.join(os.path.dirname(__file__), 'process_report.json')
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'completed_at': json.dumps(datetime.now().isoformat()),
            'total_batches': total_batches,
            'stats': stats,
            'errors': errors
        }, f, indent=2)

def update_material_blanks(client, material_id: str, transcript: List[Dict]) -> bool:
    """更新素材的 transcript blanks 字段"""
    try:
        client.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()
        return True
    except Exception as e:
        print(f"   ❌ 更新失败: {e}")
        return False

# ============ 主处理逻辑 ============
def process_material_transcript(material: Dict) -> Tuple[List[Dict], Dict]:
    """处理单个素材的 transcript

    返回: (updated_transcript, statistics)
    """
    transcript = material.get('transcript', [])

    if not transcript or not isinstance(transcript, list):
        return transcript, {'processed': 0, 'updated': 0, 'skipped': 0}

    stats = {'processed': 0, 'updated': 0, 'skipped': 0}
    updated_transcript = []

    for sentence in transcript:
        sentence_text = sentence.get('text', '')

        if not sentence_text:
            updated_transcript.append(sentence)
            stats['skipped'] += 1
            continue

        stats['processed'] += 1

        # 强制重新处理所有句子（忽略现有的 blanks 字段）
        # 这样可以修复之前不正确的挖空结果

        # 分析句子
        words_with_pos = analyze_sentence_words(sentence_text)

        # 选择最佳挖空词
        blank_info = select_best_blank(words_with_pos, [], sentence_text)

        if blank_info and 'word' in blank_info:
            # 更新句子
            sentence['blanks'] = [{
                'word': blank_info['word'],
                'index': blank_info['index'],
                'pos': blank_info['pos'],
                'is_core': blank_info['is_core']
            }]
            stats['updated'] += 1
        else:
            # 没有找到合适的词，设置空的 blanks
            sentence['blanks'] = []

        updated_transcript.append(sentence)

    return updated_transcript, stats

def show_sentence_previews(client):
    """显示特定句子的挖空预览"""
    target_sentences = [
        "She's everything to me.",
        "It's seven o'clock.",
        "That's too bad."
    ]

    # 查找包含这些句子的素材
    result = client.table('materials').select('title, transcript').execute()

    found_count = 0
    for material in result.data:
        transcript = material.get('transcript', [])
        for sentence in transcript:
            text = sentence.get('text', '')
            blanks = sentence.get('blanks', [])

            # 检查是否匹配目标句子
            for target in target_sentences:
                if target.lower() in text.lower():
                    print(f"\n📌 {text}")
                    if blanks and len(blanks) > 0:
                        blank = blanks[0]
                        word = blank.get('word', '')
                        index = blank.get('index', 0)
                        is_core = blank.get('is_core', False)

                        # 构建挖空后的文本
                        words = text.split()
                        if 0 <= index < len(words):
                            words[index] = f"______"
                            blanked_text = ' '.join(words)

                            print(f"   挖空: {blanked_text}")
                            print(f"   答案: {word} (位置: {index}, 核心词: {'✓' if is_core else '✗'})")
                    else:
                        print(f"   ⏭️  无挖空")
                    found_count += 1
                    break

            if found_count >= len(target_sentences):
                break

def preview_blanks(materials: List[Dict], num_samples: int = 5):
    """预览挖空结果"""
    print("\n" + "="*70)
    print(f"📝 随机预览 {num_samples} 个素材的挖空结果")
    print("="*70)

    # 过滤出有更新的素材
    updated_materials = [
        m for m in materials
        if m.get('transcript') and
        any(s.get('blanks') for s in m.get('transcript', []))
    ]

    if not updated_materials:
        print("⚠️  没有找到有挖空数据的素材")
        return

    # 随机选择
    samples = random.sample(updated_materials, min(num_samples, len(updated_materials)))

    for i, material in enumerate(samples, 1):
        print(f"\n{'─'*70}")
        print(f"【{i}】{material.get('title', 'Unknown')}")
        print(f"{'─'*70}")

        transcript = material.get('transcript', [])
        blank_sentences = [s for s in transcript if s.get('blanks')]

        if not blank_sentences:
            print("  (无挖空数据)")
            continue

        # 显示前 3 个有挖空的句子
        for j, sentence in enumerate(blank_sentences[:3], 1):
            text = sentence.get('text', '')
            blanks = sentence.get('blanks', [])

            if blanks and len(blanks) > 0:
                blank = blanks[0]
                word = blank.get('word', '')
                index = blank.get('index', 0)
                is_core = blank.get('is_core', False)

                # 构建显示文本
                words = text.split()
                if 0 <= index < len(words):
                    words[index] = f"[{word}]"
                    display_text = ' '.join(words)

                    print(f"\n  句子 {j}:")
                    print(f"  原文: {text}")
                    print(f"  挖空: {display_text}")
                    print(f"  挖空词: {word} (核心词汇: {'✓' if is_core else '✗'})")

        print()

def print_blanks_preview(material: Dict):
    """打印单个素材的 blanks 预览"""
    print("\n" + "="*70)
    print("📝 Blanks 字段预览")
    print("="*70)
    print(f"素材: {material.get('title', 'Unknown')} (slug: {material.get('slug', 'N/A')})")
    print("="*70)

    transcript = material.get('transcript', [])

    if not transcript:
        print("⚠️  该素材没有 transcript 数据")
        return

    print(f"\n共 {len(transcript)} 个句子\n")

    for i, sentence in enumerate(transcript, 1):
        text = sentence.get('text', '')
        blanks = sentence.get('blanks', [])

        print(f"[{i}] {text}")

        if blanks and len(blanks) > 0:
            for blank in blanks:
                word = blank.get('word', '')
                index = blank.get('index', 0)
                pos = blank.get('pos', '')
                is_core = blank.get('is_core', False)

                # 构建挖空后的文本
                words = text.split()
                if 0 <= index < len(words):
                    words[index] = f"______"
                    blanked_text = ' '.join(words)

                    print(f"    🔲 挖空: {blanked_text}")
                    print(f"       答案: {word} (位置: {index}, 词性: {pos}, 核心词: {'✓' if is_core else '✗'})")
        else:
            print(f"    ⏭️  无挖空")
        print()

def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='优化单词听写挖空逻辑')
    parser.add_argument('--test-slug', type=str, help='测试模式：仅处理指定 slug 的素材，不更新数据库')
    parser.add_argument('--update-slug', type=str, help='更新模式：仅处理指定 slug 的素材，并更新到数据库')
    parser.add_argument('--batch-size', type=int, default=10, help='批量处理时每批的素材数量（默认：10）')
    parser.add_argument('--resume', action='store_true', help='从断点恢复处理')
    parser.add_argument('--silent', action='store_true', help='静默模式，减少输出')
    parser.add_argument('--preview-only', action='store_true', help='仅预览，不更新数据库')
    args = parser.parse_args()

    test_mode = bool(args.test_slug)
    single_mode = bool(args.test_slug or args.update_slug)
    batch_mode = not single_mode and not test_mode
    silent_mode = args.silent or batch_mode
    preview_only = args.preview_only

    if not silent_mode:
        print("="*70)
        mode_str = ""
        if test_mode:
            mode_str = " (测试模式)"
        elif args.update_slug:
            mode_str = f" (单素材更新: {args.update_slug})"
        elif batch_mode:
            mode_str = f" (批量模式，每批 {args.batch_size} 个素材)"
        if preview_only:
            mode_str += " [预览模式]"
        print("🚀 优化单词听写挖空逻辑" + mode_str)
        print("="*70)

    # 检查环境变量
    if not SUPABASE_KEY:
        if not silent_mode:
            print("❌ 错误: 未找到 SUPABASE_ANON_KEY")
            print("\n请设置环境变量:")
            print("  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key")
        sys.exit(1)

    # 初始化 NLTK
    if not setup_nltk():
        sys.exit(1)

    # 加载核心词汇
    if not silent_mode:
        print("\n📚 加载核心词汇列表...")
    load_core_vocabulary()

    # 连接 Supabase
    if not silent_mode:
        print("\n🔗 连接 Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材
    slug_filter = args.test_slug if test_mode else (args.update_slug if args.update_slug else None)
    materials = get_all_materials(client, slug=slug_filter)

    if not materials:
        sys.exit(1)

    # 断点恢复
    start_index = 0
    if args.resume and batch_mode:
        checkpoint = load_checkpoint()
        if checkpoint:
            last_id = checkpoint.get('last_id')
            start_index = next((i for i, m in enumerate(materials) if m.get('id') == last_id), 0) + 1
            if not silent_mode:
                print(f"\n🔄 从断点恢复：Batch {checkpoint.get('batch_num') + 1}, 素材 {start_index + 1}/{len(materials)}")

    # 处理每个素材
    if not silent_mode:
        print("\n🔧 开始处理...")
        print("="*70)

    total_stats = {'processed': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
    error_list = []
    processed_count = 0

    # 批量处理
    batch_size = args.batch_size if batch_mode else len(materials)
    total_batches = (len(materials) + batch_size - 1) // batch_size

    for batch_num in range(total_batches):
        start_idx = start_index + batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(materials))

        if start_idx >= len(materials):
            break

        batch = materials[start_idx:end_idx]

        if batch_mode:
            print(f"\n📦 Batch {batch_num + 1}/{total_batches} (素材 {start_idx + 1}-{end_idx})")

        batch_updated = 0

        for i, material in enumerate(batch, start_idx):
            material_id = material.get('id')
            title = material.get('title', 'Unknown')

            if not silent_mode and not batch_mode:
                print(f"\n[{i + 1}/{len(materials)}] 处理: {title}")

            # 处理 transcript
            updated_transcript, stats = process_material_transcript(material)

            total_stats['processed'] += stats['processed']
            total_stats['updated'] += stats['updated']
            total_stats['skipped'] += stats['skipped']

            # 更新数据库
            should_update_db = not test_mode and not preview_only
            if stats['updated'] > 0:
                if not silent_mode and not batch_mode:
                    print(f"  📊 处理 {stats['processed']} 句，更新 {stats['updated']} 句")

                if should_update_db:
                    success = update_material_blanks(client, material_id, updated_transcript)
                    if success:
                        batch_updated += 1
                        if not silent_mode and not batch_mode:
                            print(f"  ✅ 已更新到数据库")
                    else:
                        total_stats['errors'] += 1
                        error_list.append({
                            'material_id': material_id,
                            'title': title,
                            'error': 'Database update failed'
                        })
                        if not silent_mode and not batch_mode:
                            print(f"  ❌ 更新失败")
                else:
                    if not silent_mode and not batch_mode:
                        if test_mode:
                            print(f"  🧪 测试模式：跳过数据库更新")
                        elif preview_only:
                            print(f"  👁️ 预览模式：跳过数据库更新")
            else:
                if not silent_mode and not batch_mode:
                    print(f"  ⏭️  无需更新")

            processed_count += 1

            # 保存断点
            if batch_mode and processed_count % batch_size == 0:
                save_checkpoint(material_id, batch_num, total_stats)

        # 批次总结
        if batch_mode:
            print(f"  ✅ Batch {batch_num + 1}/{total_batches} 完成 - 更新了 {batch_updated}/{len(batch)} 个素材")

            # 每5个批次保存一次报告
            if (batch_num + 1) % 5 == 0:
                save_report(total_stats, total_batches, error_list)
                print(f"  💾 进度已保存到 process_report.json")

    # 测试模式：显示详细预览
    if test_mode:
        if not silent_mode:
            # 获取处理后的数据用于预览
            for material in materials:
                updated_transcript, _ = process_material_transcript(material)
                material['transcript'] = updated_transcript
                print_blanks_preview(material)
            print("\n" + "="*70)
            print("🧪 测试模式完成 - 未修改数据库")
            print("="*70)
        return

    # 总结
    if not silent_mode:
        print("\n" + "="*70)
        print("✅ 处理完成！")
        print("="*70)
        print(f"\n统计:")
        print(f"  总素材数: {len(materials)}")
        print(f"  总句子数: {total_stats['processed']}")
        print(f"  更新句子数: {total_stats['updated']}")
        print(f"  跳过句子数: {total_stats['skipped']}")
        print(f"  错误数: {total_stats['errors']}")

        # 🔍 显示特定句子预览
        if not silent_mode:
            print("\n" + "="*70)
            print("🔍 关键句子预览")
            print("="*70)
            show_sentence_previews(client)

        # 预览结果（仅在非批量模式下）
        if not batch_mode and not preview_only:
            print("\n⏳ 获取预览数据...")
            materials = get_all_materials(client)
            preview_blanks(materials, num_samples=5)

        print("\n" + "="*70)
        print("🎉 全部完成！")
        print("="*70)

    # 保存最终报告
    if batch_mode:
        save_report(total_stats, total_batches, error_list)
        if not silent_mode:
            print(f"\n📄 报告已保存到 process_report.json")

        # 清除断点文件
        checkpoint_file = os.path.join(os.path.dirname(__file__), '.improve_blanks_checkpoint.json')
        if os.path.exists(checkpoint_file):
            os.remove(checkpoint_file)
            if not silent_mode:
                print(f"🗑️  已清除断点文件")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
