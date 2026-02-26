/**
 * 智能语音比对模块 - "口语优先"容错版本
 * 核心理念：只要发音在合理范围内，一律判定为正确
 */

// ============ 常见连读/缩写等效映射 ============
// 处理 "we've" vs "we", "I'm" vs "I am" 等情况
const CONTRACTION_EQUIVALENTS: Record<string, string[]> = {
  "we've": ['we', 'we have'],
  "i'm": ['i', 'i am'],
  "i've": ['i', 'i have'],
  "i'll": ['i', 'i will'],
  "i'd": ['i', 'i would', 'i had'],
  "you're": ['you', 'you are'],
  "you've": ['you', 'you have'],
  "you'll": ['you', 'you will'],
  "you'd": ['you', 'you would', 'you had'],
  "he's": ['he', 'he is', 'he has'],
  "she's": ['she', 'she is', 'she has'],
  "it's": ['it', 'it is'],
  "that's": ['that', 'that is'],
  "there's": ['there', 'there is'],
  "here's": ['here', 'here is'],
  "what's": ['what', 'what is'],
  "who's": ['who', 'who is'],
  "let's": ['let', 'let us'],
  "don't": ['dont', 'do not'],
  "doesn't": ['doesnt', 'does not'],
  "didn't": ['didnt', 'did not'],
  "won't": ['wont', 'will not'],
  "wouldn't": ['wouldnt', 'would not'],
  "can't": ['cant', 'cannot'],
  "couldn't": ['couldnt', 'could not'],
  "shouldn't": ['shouldnt', 'should not'],
  "aren't": ['arent', 'are not'],
  "isn't": ['isnt', 'is not'],
  "wasn't": ['wasnt', 'was not'],
  "weren't": ['werent', 'were not'],
  "haven't": ['havent', 'have not'],
  "hasn't": ['hasnt', 'has not'],
  "hadn't": ['hadnt', 'had not'],
  "couldn't": ['couldnt', 'could not'],
  "mightn't": ['mightnt', 'might not'],
  "mustn't": ['mustnt', 'must not'],
  "shan't": ['shant', 'shall not'],
}

// ============ 合并词等效映射 ============
// 处理 "everyday" vs "every day", "alot" vs "a lot" 等
const MERGED_WORD_EQUIVALENTS: Record<string, string[]> = {
  "everyday": ['every day'],
  "every day": ['everyday'],
  " alot": ['a lot'],
  "infact": ['in fact'],
  "infact": ['in fact'],
  "alright": ['all right'],
  "ok": ['okay'],
  "gotta": ['got to'],
  "kinda": ['kind of'],
  "sorta": ['sort of'],
  "wanna": ['want to'],
  "gonna": ['going to'],
  "gimme": ['give me'],
  "lemme": ['let me'],
  "dunno": ['dont know', 'do not know'],
  "cuz": ['because'],
  "cause": ['because'],
  "tho": ['though'],
  "thru": ['through'],
  "till": ['until'],
}

// ============ Metaphone 算法实现（简化版）============
// 将单词转换为语音编码，忽略发音差异
function metaphone(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return ''

  let result = ''
  let i = 0

  // 跳过无声词开头
  while (i < w.length && 'aeiou'.includes(w[i])) {
    result += w[i]
    i++
  }

  while (i < w.length) {
    const ch = w[i]
    const nextCh = w[i + 1] || ''

    // 特殊规则
    if (ch === 'c' && nextCh === 'h') {
      result += 'x'  // CH → X
      i += 2
    } else if (ch === 'c' && (nextCh === 'e' || nextCh === 'i' || nextCh === 'y')) {
      result += 's'  // CI/CE/CY → S
      i += 2
    } else if (ch === 'c') {
      result += 'k'  // C → K
      i++
    } else if (ch === 'd' && nextCh === 'g') {
      result += 'j'  // DG → J
      i += 2
    } else if (ch === 'g' && (nextCh === 'e' || nextCh === 'i' || nextCh === 'y')) {
      result += 'j'  // GI/GE/GY → J
      i += 2
    } else if (ch === 'g' && nextCh === 'h') {
      result += 'k'  // GH → K
      i += 2
    } else if (ch === 'h' && (i > 0 && 'aeiou'.includes(w[i - 1]))) {
      // 元音后的 H 无声，跳过
      i++
    } else if (ch === 'k' && nextCh === 'n') {
      result += 'n'  // KN → N
      i += 2
    } else if (ch === 'g' && nextCh === 'n') {
      result += 'n'  // GN → N
      i += 2
    } else if (ch === 'p' && nextCh === 'h') {
      result += 'f'  // PH → F
      i += 2
    } else if (ch === 'q') {
      result += 'k'  // Q → K
      i++
    } else if (ch === 's' && nextCh === 'h') {
      result += 'x'  // SH → X
      i += 2
    } else if (ch === 't' && nextCh === 'h') {
      result += '0'  // TH → θ (用0表示)
      i += 2
    } else if (ch === 't' && nextCh === 'c' && (w[i + 2] || '') === 'h') {
      result += '0'  // TCH → θ
      i += 3
    } else if (ch === 'w' && i > 0 && 'aeiou'.includes(w[i - 1])) {
      // 元音后的 W 无声，跳过
      i++
    } else if ('aeiou'.includes(ch)) {
      result += ch
      i++
    } else if ('bdfgjklmnpqrstvxyz'.includes(ch)) {
      result += ch
      i++
    } else {
      i++
    }
  }

  return result
}

// 计算两个 Metaphone 编码的相似度
function calculateMetaphoneSimilarity(code1: string, code2: string): number {
  if (code1 === code2) return 1.0

  // 使用 Levenshtein 距离计算编辑距离
  const dp: number[][] = []
  for (let i = 0; i <= code1.length; i++) {
    dp[i] = []
    for (let j = 0; j <= code2.length; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else {
        const cost = code1[i - 1] === code2[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        )
      }
    }
  }

  const maxLen = Math.max(code1.length, code2.length)
  if (maxLen === 0) return 1.0
  return (maxLen - dp[code1.length][code2.length]) / maxLen
}

// ============ 高频误判词对（STT 常见混淆）- 扩展版 ============
const HIGH_FREQUENCY_MISHEARS: Record<string, string[]> = {
  // th- 开头词丢失 th
  'this': ['is', 'his', 'this', 'tis', 'dis'],
  'is': ['this', 'his', 'is', 's', 'in'],
  'that': ['at', 'that', 'tat'],
  'there': ['their', 'there', 'here'],
  'their': ['there', 'their', 'there\'s'],
  'think': ['thing', 'think', 'sink', 'tink'],
  'thing': ['think', 'thing', 'ting'],
  'thought': ['taught', 'thought', 'thot', 'tot'],
  'though': ['throw', 'though', 'tho', 'tho'],
  'through': ['threw', 'through', 'thru'],
  'the': ['a', 'the', 'de', 'da'],
  'then': ['than', 'then', 'den', 'den'],
  'than': ['then', 'than', 'dan', 'den'],
  'those': ['these', 'those', 'dose'],
  'these': ['those', 'these', 'dis'],
  'they': ['day', 'they', 'dey', 'de'],
  'them': ['him', 'them', 'dem', 'em'],

  // 介词混淆
  'to': ['too', 'to', 'tu', 'do', 'du'],
  'too': ['to', 'too', 'tu', 'two'],
  'two': ['to', 'too', 'two', 'tu'],
  'for': ['four', 'for', 'fer', 'from'],
  'four': ['for', 'four', 'fore', 'far'],
  'from': ['form', 'from', 'frm', 'for'],
  'of': ['off', 'of', 'ov', 'up'],
  'off': ['of', 'off', 'of', 'up'],
  'in': ['on', 'in', 'an', 'en'],
  'on': ['in', 'on', 'an', 'un'],
  'at': ['that', 'at', 'it', 'et'],
  'with': ['without', 'with', 'wit', 'wid'],
  'without': ['with', 'without', 'witout'],
  'by': ['my', 'by', 'buy', 'be'],

  // 代词混淆
  'your': ['you\'re', 'your', 'you', 'ur'],
  'you\'re': ['your', 'you\'re', 'you', 'ur'],
  'you': ['ya', 'you', 'yo', 'ju'],
  'he': ['she', 'he', 'e', 'im'],
  'she': ['he', 'she', 'e'],
  'it': ['is', 'it', 'its', 'in'],
  'its': ['it\'s', 'its', 'it', 'is'],
  'it\'s': ['its', 'it\'s', 'it', 'is'],
  'his': ['is', 'his', 'him', 'this'],
  'him': ['his', 'him', 'them', 'em'],
  'her': ['here', 'her', 'his', 'hers'],
  'hers': ['her', 'hers', 'his'],
  'my': ['me', 'my', 'by', 'may'],
  'me': ['my', 'me', 'be'],

  // 动词混淆（常见变形错误）
  'have': ['has', 'have', 'av', 'having', 'of'],
  'has': ['have', 'has', 'az', 'is', 'his'],
  'had': ['have', 'had', 'has', 'at'],
  'was': ['were', 'was', 'us', 'is'],
  'were': ['was', 'were', 'we\'re', 'where', 'wor'],
  'been': ['being', 'been', 'ben', 'bin'],
  'being': ['been', 'being', 'ben'],
  'go': ['going', 'go', 'do', 'went'],
  'going': ['go', 'going', 'gonna', 'gin'],
  'went': ['going', 'went', 'want', 'when'],
  'get': ['got', 'get', 'git'],
  'got': ['get', 'got', 'gotten'],
  'do': ['does', 'do', 'did', 'to', 'du'],
  'does': ['do', 'does', 'did', 'is'],
  'did': ['do', 'does', 'did', 'de'],
  'make': ['made', 'make', 'may'],
  'made': ['make', 'made', 'may'],
  'take': ['took', 'taken', 'take'],
  'took': ['take', 'took', 'taken'],
  'taken': ['take', 'took', 'taken', 'takin'],
  'come': ['came', 'come', 'cum', 'com'],
  'came': ['come', 'came', 'can'],
  'say': ['said', 'say', 'says', 'see'],
  'said': ['say', 'said', 'says', 'set'],
  'says': ['say', 'said', 'says', 'see'],
  'see': ['say', 'see', 'saw', 'seen'],
  'saw': ['see', 'saw', 'seen', 'was'],
  'seen': ['see', 'saw', 'seen', 'being'],
  'know': ['no', 'know', 'knew', 'kno'],
  'knew': ['new', 'knew', 'know', 'n'],
  'think': ['thing', 'think', 'thought', 'tink'],
  'thought': ['think', 'thought', 'taught', 'thot', 'though'],
  'tell': ['told', 'tell', 'talk'],
  'told': ['tell', 'told', 'talk', 'to'],
  'ask': ['asked', 'ask', 'ast', 'aks'],
  'asked': ['ask', 'asked', 'ast', 'aks'],
  'look': ['looks', 'looking', 'look', 'luk'],
  'looks': ['look', 'looks', 'looking', 'luk'],
  'looking': ['look', 'looks', 'looking', 'luking'],
  'want': ['wanted', 'want', 'wants', 'went'],
  'wanted': ['want', 'wanted', 'wants'],
  'wants': ['want', 'wanted', 'wants', 'once'],
  'need': ['needed', 'need', 'needs', 'kneed'],
  'needs': ['need', 'needed', 'needs', 'knees'],
  'like': ['likes', 'liked', 'like', 'lack'],
  'likes': ['like', 'liked', 'likes'],
  'liked': ['like', 'likes', 'liked', 'luck'],
  'love': ['loved', 'love', 'lives'],
  'hate': ['hated', 'hate', 'hat'],
  'give': ['gave', 'given', 'give', 'gave'],
  'gave': ['give', 'given', 'gave', 'gav'],
  'given': ['give', 'gave', 'given', 'givin'],

  // 名词混淆
  'some': ['sum', 'some', 'sem', 'sun'],
  'more': ['moor', 'more', 'mor', 'most'],
  'most': ['more', 'most', 'must', 'much'],
  'much': ['many', 'much', 'must', 'mush'],
  'many': ['any', 'many', 'much', 'man'],
  'any': ['many', 'any', 'enny', 'in'],
  'all': ['ill', 'all', 'ol', 'well'],
  'people': ['person', 'people', 'peoples', 'pipol'],
  'person': ['people', 'person', 'persons'],
  'thing': ['things', 'thing', 'think', 'ting'],
  'things': ['thing', 'things', 'thinks'],
  'time': ['times', 'time', 'thyme', 'tim'],
  'times': ['time', 'times', 'thymes'],
  'way': ['ways', 'way', 'away', 'weigh'],
  'ways': ['way', 'ways', 'aways', 'weighs'],
  'work': ['works', 'working', 'work', 'walk', 'werk'],
  'works': ['work', 'works', 'working'],
  'working': ['work', 'works', 'working', 'werk'],
  'walk': ['works', 'walk', 'walking', 'wol', 'werk'],
  'walked': ['walk', 'walking', 'walked', 'work'],
  'walking': ['walk', 'walked', 'walking', 'woking'],
  'word': ['words', 'word', 'world', 'wird', 'wird'],
  'words': ['word', 'words', 'worlds'],
  'world': ['word', 'world', 'words', 'wereld', 'wurld'],
  'place': ['places', 'place', 'plays', 'plaice'],
  'right': ['write', 'right', 'rit', 'writ', 'wright'],
  'write': ['right', 'write', 'rit', 'writ', 'riding'],
  'wrote': ['right', 'write', 'wrote', 'rot'],
  'which': ['witch', 'which', 'wich', 'what', 'witch'],
  'witch': ['which', 'witch', 'wich', 'with'],
  'what': ['that', 'what', 'wot', 'watch', 'wat'],
  'when': ['wen', 'when', 'win', 'than', 'then'],
  'where': ['were', 'where', 'wear', 'ware', 'we\'re'],
  'were': ['where', 'were', 'we\'re', 'wor', 'are'],
  'who': ['how', 'who', 'whom', 'whose', 'hoo'],
  'how': ['who', 'how', 'now', 'hou'],
  'why': ['what', 'why', 'wye'],
  'because': ['cause', 'cuz', 'becouse', 'because'],

  // 数字和量词
  'one': ['won', 'one', '1'],
  'won': ['one', 'won', '1'],
  'two': ['to', 'too', 'two', '2'],
  'three': ['tree', 'three', '3', 'free'],
  'four': ['for', 'four', 'fore', '4'],
  'five': ['fi', 'five', '5'],
  'first': ['first', 'fist', '1st'],
  'second': ['second', 'sec', '2nd'],
  'third': ['third', 'thirt', '3rd'],

  // 形容词混淆
  'good': ['would', 'good', 'gud', 'got'],
  'bad': ['bed', 'bad', 'bat'],
  'big': ['bigger', 'big', 'beg'],
  'small': ['smell', 'small', 'smal'],
  'long': ['longer', 'long', 'wrong'],
  'short': ['shorter', 'short', 'sort', 'shot'],
  'old': ['older', 'old', 'all', 'ol'],
  'new': ['knew', 'new', 'nu', 'knew'],
  'same': ['some', 'same', 'seem', 'saym'],
  'different': ['difference', 'different', 'diffrent'],
  'difference': ['different', 'difference', 'diffrence'],
  'other': ['another', 'other', 'others', 'utha'],
  'another': ['other', 'another', 'a nother'],

  // 高频动词
  'left': ['leaved', 'left', 'lift', 'leaveft'],
  'lift': ['left', 'lift', 'liveft', 'lisft'],
  'leaves': ['lives', 'leaves', 'leave', 'lefts'],
  'lives': ['leaves', 'lives', 'live', 'leave'],
  'leave': ['lives', 'leave', 'leaf', 'leaves'],
  'live': ['lives', 'live', 'leave', 'leaf'],
  'life': ['live', 'life', 'lives'],

  // 常见 STT 误判
  'hear': ['here', 'hear', 'her', 'here\'s'],
  'here': ['hear', 'here', 'her', 'hair'],
  'hair': ['here', 'hair', 'hear', 'her'],
  'her': ['here', 'hear', 'her', 'hair'],
  'their': ['there', 'their', 'they\'re', 'there\'s'],
  'they\'re': ['their', 'there', 'they\'re', 'they are'],
  'really': ['rarely', 'really', 'realy', 'relay'],
  'very': ['vary', 'very', 'verry'],
  'pretty': ['petty', 'pretty', 'prity'],
  'just': ['gesture', 'just', 'dust', 'gust'],
  'only': ['ownly', 'only', 'onley'],
  'also': ['although', 'also', 'all so'],
  'always': ['all ways', 'always', 'allways'],
  'already': ['all ready', 'already', 'allready'],
  'probably': ['probably', 'probable', 'prolly'],
  'maybe': ['may be', 'maybe', 'mebi'],
  'okay': ['ok', 'okay', 'okey'],
  'yes': ['yeah', 'yes', 'yep', 'yas'],
  'yeah': ['yes', 'yeah', 'yea', 'ya'],
  'no': ['know', 'no', 'now', 'nor'],
  'not': ['now', 'not', 'knot', 'hot'],
  'now': ['know', 'no', 'now', 'not'],
  'well': ['will', 'well', 'we\'ll', 'whel'],
  'will': ['well', 'will', 'we\'ll', 'with'],
  'we\'ll': ['well', 'will', 'we\'ll', 'we will'],
  'can': ['can\'t', 'can', 'ken', 'kin'],
  'can\'t': ['can', 'cant', 'cannot', 'ken'],
  'cannot': ['can', 'can\'t', 'cannot', 'can not'],
  'should': ['shouldn\'t', 'should', 'could', 'wood'],
  'shouldn\'t': ['should', 'shouldnt', 'should not'],
  'could': ['would', 'could', 'good', 'cud'],
  'would': ['could', 'would', 'wood', 'good'],
  'might': ['might\'nt', 'might', 'may', 'mite'],
  'must': ['mustn\'t', 'must', 'much', 'mast'],
  'may': ['might', 'may', 'may\'be', 'me'],
  'about': ['abought', 'about', 'abowt', 'bout'],
  'out': ['about', 'out', 'our', 'ought'],
  'up': ['up', 'op', 'upon', 'cup'],
  'down': ['done', 'down', 'doun', 'town'],
  'over': ['offer', 'over', 'ova', 'our'],
  'under': ['and', 'under', 'unda', 'other'],
  'after': ['offer', 'after', 'afta', 'half'],
  'before': ['befor', 'before', 'bafor', 'aphor'],
  'again': ['against', 'again', 'agen', 'a gain'],
  'against': ['again', 'against', 'across', 'agen'],
  'around': ['round', 'around', 'aroun', 'sound'],
  'between': ['among', 'between', 'bitween', 'b'],
  'among': ['around', 'among', 'along', 'amang'],
  'through': ['threw', 'through', 'thru', 'thought'],
  'during': ['during', 'durring', 'doing'],
  'until': ['till', 'until', 'til', 'till'],
  'since': ['sence', 'since', 'cents', 'seen'],
  'while': ['will', 'while', 'whilst', 'wile'],
  'often': ['offen', 'often', 'of', 'all'],
  'never': ['ever', 'never', 'neva', 'eva'],
  'ever': ['never', 'ever', 'eva', 'even'],
  'always': ['all ways', 'always', 'allways', 'olways'],
  'sometimes': ['sometime', 'sometimes', 'sumtimes', 'sum'],
  'sometime': ['sometimes', 'sometime', 'sumtime'],
  'still': ['steel', 'still', 'stil', 'stell'],
  'already': ['all ready', 'already', 'allready', 'olready'],
  'yet': ['yes', 'yet', 'yet\'s', 'yep'],
  'just': ['gesture', 'just', 'dust', 'jess'],
  'only': ['ownly', 'only', 'onley', 'un'],
  'also': ['although', 'also', 'all so', 'so'],
  'too': ['to', 'too', 'two', 'tu'],
  'very': ['vary', 'very', 'verry', 'vary'],
  'really': ['rarely', 'really', 'realy', 'rly'],
  'quite': ['quiet', 'quite', 'quote', 'white'],
  'rather': ['either', 'rather', 'ratha', 'radar'],
  'either': ['neither', 'either', 'eather', 'ither'],
  'neither': ['either', 'neither', 'nither', 'night'],
  'both': ['both', 'booth', 'bot', 'boths'],
  'each': ['each', 'eich', 'itch', 'eat'],
  'every': ['ever', 'every', 'evry', 'evey'],
  'all': ['ill', 'all', 'ol', 'well'],
  'none': ['no', 'none', 'non', 'know'],
  'some': ['sum', 'some', 'sem', 'sun'],
  'any': ['many', 'any', 'anny', 'in'],
  'much': ['many', 'much', 'must', 'mush'],
  'many': ['any', 'many', 'man', 'mini'],
  'such': ['much', 'such', 'sutch', 'so'],
  'same': ['some', 'same', 'seem', 'saym'],
  'own': ['on', 'own', 'an', 'ohn'],
  'another': ['other', 'another', 'a nother', 'a-nother'],
  'other': ['another', 'other', 'others', 'utha'],
  'else': ['is', 'else', 'els', 'as'],
  'next': ['text', 'next', 'nekst'],
  'last': ['lost', 'last', 'least', 'lust'],
  'first': ['first', 'fist', '1st', 'furst'],
  'second': ['second', 'sec', '2nd', 'sekand'],
  'last': ['lost', 'last', 'least', 'lust'],
}

// 上下文感知的高频词对（基于 N-gram 概率）
const CONTEXTUAL_PAIRS: Array<[string, string, number]> = [
  // [target, recognized, probability_weight]
  ['this', 'is', 0.85],  // "however this" 中 this 概率极高
  ['that', 'at', 0.70],
  ['there', 'here', 0.65],
  ['think', 'thing', 0.75],
  ['thought', 'taught', 0.70],
  ['from', 'form', 0.65],
  ['have', 'has', 0.60],
  ['some', 'sum', 0.65],
  ['know', 'no', 0.70],
  ['right', 'write', 0.70],
  ['which', 'witch', 0.65],
  ['where', 'were', 0.70],
  ['your', 'you\'re', 0.70],
]

/**
 * 智能匹配两个单词 - "口语优先"容错版本
 * 核心理念：只要发音在合理范围内，一律判定为正确
 *
 * @param targetWord 目标单词（原文）
 * @param spokenWord 用户朗读的单词（STT识别）
 * @param contextWords 上下文单词（用于概率校验）
 * @returns 匹配结果和相似度分数
 */
export interface IntelligentMatchResult {
  isMatch: boolean
  confidence: number  // 0-1，置信度
  matchType: 'exact' | 'metaphone' | 'contextual' | 'fuzzy' | 'no_match'
  reason: string
}

export function intelligentMatch(
  targetWord: string,
  spokenWord: string,
  contextWords?: string[]
): IntelligentMatchResult {
  // 预处理：转小写，移除标点
  const normalize = (w: string) => w.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const target = normalize(targetWord)
  const spoken = normalize(spokenWord)

  // 0. 检查缩写/合并词等效映射（we've → we, everyday → every day）
  // 优先级最高，因为这是用户主动选择的表达方式
  const targetContractions = CONTRACTION_EQUIVALENTS[target] || []
  if (targetContractions.includes(spoken)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Contraction equivalent (e.g., "we\'ve" → "we")'
    }
  }

  const spokenContractions = CONTRACTION_EQUIVALENTS[spoken] || []
  if (spokenContractions.includes(target)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Contraction equivalent (e.g., "we" → "we\'ve")'
    }
  }

  const targetMerged = MERGED_WORD_EQUIVALENTS[target] || []
  if (targetMerged.includes(spoken)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Merged word equivalent (e.g., "everyday" ↔ "every day")'
    }
  }

  // 1. 精确匹配
  if (target === spoken) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'exact',
      reason: 'Exact match'
    }
  }

  // 2. 检查高频误判词表（扩展版，包含更多常见混淆）
  const mishears = HIGH_FREQUENCY_MISHEARS[target] || []
  if (mishears.includes(spoken)) {
    return {
      isMatch: true,
      confidence: 0.90,
      matchType: 'fuzzy',
      reason: 'High-frequency mishear pair (STT error correction)'
    }
  }

  // 反向检查：用户说的词可能对应多个目标词
  for (const [key, values] of Object.entries(HIGH_FREQUENCY_MISHEARS)) {
    if (values.includes(spoken) && (key === target || values.includes(target))) {
      return {
        isMatch: true,
        confidence: 0.88,
        matchType: 'fuzzy',
        reason: 'High-frequency mishear pair (reverse match)'
      }
    }
  }

  // 3. Metaphone 语音相似度检测（降低阈值，提高容错）
  const targetMetaphone = metaphone(target)
  const spokenMetaphone = metaphone(spoken)
  const metaphoneSimilarity = calculateMetaphoneSimilarity(targetMetaphone, spokenMetaphone)

  // 降低阈值从 0.8 → 0.6，接受更多语音相似的词
  if (metaphoneSimilarity >= 0.6) {
    return {
      isMatch: true,
      confidence: 0.85,
      matchType: 'metaphone',
      reason: `Metaphone similarity ${(metaphoneSimilarity * 100).toFixed(0)}%`
    }
  }

  // 4. 编辑距离容错（放宽条件）
  const editDistance = calculateEditDistance(target, spoken)
  const maxLen = Math.max(target.length, spoken.length)
  const similarity = (maxLen - editDistance) / maxLen

  // 容错2个字符（之前是1个），且相似度 >= 0.6
  if (editDistance <= 2 && similarity >= 0.6) {
    return {
      isMatch: true,
      confidence: 0.75,
      matchType: 'fuzzy',
      reason: `Edit distance ${editDistance}, similarity ${(similarity * 100).toFixed(0)}%`
    }
  }

  // 5. 上下文感知匹配（基于 N-gram 概率）
  if (contextWords && contextWords.length > 0) {
    for (const [ctxTarget, ctxSpoken, weight] of CONTEXTUAL_PAIRS) {
      if (target === ctxTarget && spoken === ctxSpoken) {
        const contextScore = calculateContextProbability(target, spoken, contextWords)

        if (contextScore >= 0.5) {  // 降低阈值从 0.7 → 0.5
          return {
            isMatch: true,
            confidence: 0.75 + (contextScore * 0.1),
            matchType: 'contextual',
            reason: `Context-aware match (probability ${(contextScore * 100).toFixed(0)}%)`
          }
        }
      }
    }
  }

  // 6. 核心元音匹配（宽松判定）
  const targetVowels = target.replace(/[^aeiou]/g, '')
  const spokenVowels = spoken.replace(/[^aeiou]/g, '')

  if (targetVowels === spokenVowels && targetVowels.length > 0) {
    return {
      isMatch: true,
      confidence: 0.70,  // 提高从 0.65 → 0.70
      matchType: 'fuzzy',
      reason: 'Core vowels match (spoken-first tolerance)'
    }
  }

  // 7. 辅音丢失检测（扩展规则）
  if (isConsonantDrop(target, spoken) || isConsonantDrop(spoken, target)) {
    return {
      isMatch: true,
      confidence: 0.75,  // 提高从 0.70 → 0.75
      matchType: 'fuzzy',
      reason: 'Consonant drop detected (common speaking variation)'
    }
  }

  // 8. 词尾 s/es/ed/ing 丢失（放宽条件）
  if (target.endsWith('s') && spoken === target.slice(0, -1)) {
    return {
      isMatch: true,
      confidence: 0.85,  // 提高从 0.80 → 0.85
      matchType: 'fuzzy',
      reason: 'Plural/present tense -s dropped'
    }
  }

  if (target.endsWith('es') && spoken === target.slice(0, -2)) {
    return {
      isMatch: true,
      confidence: 0.85,
      matchType: 'fuzzy',
      reason: 'Verb ending -es dropped'
    }
  }

  if (target.endsWith('ed') && spoken === target.slice(0, -2)) {
    return {
      isMatch: true,
      confidence: 0.82,
      matchType: 'fuzzy',
      reason: 'Verb ending -ed dropped (common STT error)'
    }
  }

  if (target.endsWith('ing') && spoken === target.slice(0, -3) + 'in') {
    return {
      isMatch: true,
      confidence: 0.80,
      matchType: 'fuzzy',
      reason: 'Verb ending -ing → -in (common informal speech)'
    }
  }

  // 9. STT 误判：首字母混淆（如 p/b, t/d, k/g）
  if (isInitialConsonantConfusion(target, spoken)) {
    return {
      isMatch: true,
      confidence: 0.72,
      matchType: 'fuzzy',
      reason: 'Initial consonant confusion (STT error)'
    }
  }

  // 10. 词尾辅音混淆（如 d/t, k/ck）
  if (isFinalConsonantConfusion(target, spoken)) {
    return {
      isMatch: true,
      confidence: 0.72,
      matchType: 'fuzzy',
      reason: 'Final consonant confusion (common speaking variation)'
    }
  }

  // 最后的兜底：如果长度差异 <= 1 且有 50% 字符相同，算部分正确
  if (Math.abs(target.length - spoken.length) <= 1 && similarity >= 0.5) {
    return {
      isMatch: true,
      confidence: 0.60,
      matchType: 'fuzzy',
      reason: 'Partial match (spoken-first leniency)'
    }
  }

  // 仍然不匹配（但返回更友好的提示）
  return {
    isMatch: false,
    confidence: 0,
    matchType: 'no_match',
    reason: 'No significant similarity found'
  }
}

// 计算编辑距离
function calculateEditDistance(a: string, b: string): number {
  const dp: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    dp[i] = []
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 删除
          dp[i][j - 1] + 1,      // 插入
          dp[i - 1][j - 1] + cost // 替换
        )
      }
    }
  }
  return dp[a.length][b.length]
}

// 检查首字母混淆（p/b, t/d, k/g, f/v, s/z, etc.）
function isInitialConsonantConfusion(target: string, spoken: string): boolean {
  if (target.length < 2 || spoken.length < 2) return false

  const confusionPairs: Array<[string, string]> = [
    ['p', 'b'], ['b', 'p'],
    ['t', 'd'], ['d', 't'],
    ['k', 'g'], ['g', 'k'],
    ['f', 'v'], ['v', 'f'],
    ['s', 'z'], ['z', 's'],
    ['th', 'd'], ['d', 'th'],
    ['th', 't'], ['t', 'th'],
    ['h', ''], ['h', ''],
  ]

  const targetRest = target.slice(1)
  const spokenRest = spoken.slice(1)

  // 如果除了首字母外都相同，检查首字母是否是混淆对
  if (targetRest === spokenRest) {
    const targetInit = target[0]
    const spokenInit = spoken[0]
    for (const [a, b] of confusionPairs) {
      if ((targetInit === a && spokenInit === b) || (targetInit === b && spokenInit === a)) {
        return true
      }
    }
  }

  return false
}

// 检查词尾辅音混淆（d/t, k/ck, etc.）
function isFinalConsonantConfusion(target: string, spoken: string): boolean {
  if (target.length < 2 || spoken.length < 2) return false

  const targetBase = target.slice(0, -1)
  const spokenBase = spoken.slice(0, -1)

  // 如果除了最后一个字母外都相同
  if (targetBase === spokenBase) {
    const targetEnd = target[target.length - 1]
    const spokenEnd = spoken[spoken.length - 1]

    // 词尾 d/t 混淆
    if ((targetEnd === 'd' && spokenEnd === 't') || (targetEnd === 't' && spokenEnd === 'd')) {
      return true
    }
    // 词尾 k/ck 混淆（已经通过其他规则处理）
    // 词尾 s/z 混淆
    if ((targetEnd === 's' && spokenEnd === 'z') || (targetEnd === 'z' && spokenEnd === 's')) {
      return true
    }
  }

  return false
}

// 检查是否是辅音丢失（如 this → is）
function isConsonantDrop(target: string, spoken: string): boolean {
  // th 开头丢失
  if (target.startsWith('th') && spoken === target.slice(2)) {
    return true
  }

  // s 开头丢失
  if (target.startsWith('s') && spoken === target.slice(1)) {
    return true
  }

  // h 开头丢失
  if (target.startsWith('h') && spoken === target.slice(1)) {
    return true
  }

  return false
}

// 计算上下文概率（简化版 N-gram）
function calculateContextProbability(
  target: string,
  spoken: string,
  context: string[]
): number {
  // 简单实现：检查目标词在前一个词后面出现的概率
  // 实际应用中可以使用真实的 N-gram 模型或 LLM

  const prevWord = context[context.length - 1]?.toLowerCase() || ''

  // 特殊规则：某些词对组合的概率权重
  const bigramWeights: Record<string, Record<string, number>> = {
    'however': { 'this': 0.95, 'is': 0.05 },  // however this 远比 however is 常见
    'but': { 'this': 0.70, 'is': 0.30 },
    'and': { 'this': 0.60, 'is': 0.40 },
    'when': { 'this': 0.65, 'is': 0.35 },
  }

  if (prevWord in bigramWeights && target in bigramWeights[prevWord]) {
    return bigramWeights[prevWord][target]
  }

  // 默认中等概率
  return 0.5
}

/**
 * 批量比对单词列表
 */
export function batchIntelligentMatch(
  targetWords: string[],
  spokenWords: string[]
): Array<{
  targetIndex: number
  spokenIndex: number
  result: IntelligentMatchResult
}> {
  const results: Array<{
    targetIndex: number
    spokenIndex: number
    result: IntelligentMatchResult
  }> = []

  // 简单的一对一匹配（实际应用中可以使用更复杂的对齐算法）
  const maxLen = Math.max(targetWords.length, spokenWords.length)

  for (let i = 0; i < maxLen; i++) {
    const target = targetWords[i]
    const spoken = spokenWords[i]

    if (!target || !spoken) {
      continue
    }

    // 提取上下文（前后各1个词）
    const context = [
      targetWords[Math.max(0, i - 1)],
      ...targetWords.slice(i + 1, i + 2)
    ]

    const result = intelligentMatch(target, spoken, context)

    results.push({
      targetIndex: i,
      spokenIndex: i,
      result
    })
  }

  return results
}
