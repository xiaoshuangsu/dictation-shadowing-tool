# 指令：重塑“语言习得”导向的雅思素材挖空逻辑

## 1. 背景与核心目标
目前的 reprocess_ietts_blanks.py 脚本逻辑过于机械（倾向于挖句首词、数字、专有名词或简单动词）。
**重构目标**：将逻辑从“随机/考试填空”转变为“语言习得（Language Acquisition）”导向。
用户通过听写，应内化【高价值表达】、【逻辑连接】和【具象动作】，而不是浪费时间拼写无意义的语气词或基础存量词汇。

---

## 2. 挖空准则（Pedagogical Rules）

### A. 绝对黑名单（禁止挖掘）
即使全句只有这些词，也跳过或不挖空：
1. **纯语气词/感叹词**：`Yes`, `No`, `Okay`, `Well`, `So`, `Very`, `Quite`.
2. **功能性缩写/代词**：`You're`, `It's`, `That's`, `I'm`, `They've`.
3. **低级/模糊词汇**：`things`, `stuff`, `get`, `use`, `go`（系动词用法）, `know`.
4. **基础数字与专有名词**：
   - 纯数字（One, 1998）和日期。
   - 人名（Louise Taylor）、地名（Atlit-Yam）、特定房间名（Adelphi）。
   - *例外：序数词如 23rd 或具有拼写挑战的月份如 September 可作为次选。*

### B. 优先级权重（高价值词汇）
按以下权重降序排列选择挖空目标：
- **【权重 10】程度、逻辑与频率副词**：如 `massively`, `throughout`, `normally`, `extremely`.
- **【权重 9】高级/具象动词**：如 `refurbishment`, `thriving`, `indicates`, `stolen`, `support`, `offer`.
- **【权重 8】比较级/最高级与描述性形容词**：如 `younger`, `useful`, `significant`, `beneficial`.
- **【权重 7】固定搭配中的语义重心**：如 `go [wrong]`, `deal [with]`, `feel [relax]`.

---

## 3. 完美示范 (Few-shot Samples for Calibration)

请参考以下案例来对齐算法审美：

| 场景分类 | 原始句子 | 错误挖空 (Discard) | **正确挖空 (Target)** | 逻辑理由 |
| :--- | :--- | :--- | :--- | :--- |
| **短语重心** | If anything goes wrong... | [goes] | **[wrong]** | 挖固定搭配的语义核心而非系动词。 |
| **学术/职场词** | ...closed for refurbishment. | [use] / [closed] | **[refurbishment]** | 挖掘高阶、具有拼写价值的职业词。 |
| **描述性表达** | ...one person younger than me. | [only] / [one] | **[younger]** | 强化比较级表达的语感。 |
| **动作结果** | ...had some things stolen... | [things] / [bag] | **[stolen]** | 避开模糊名词，锁定核心事件动作。 |
| **评价逻辑** | That's the most useful part. | [You're] / [most] | **[useful]** | 避开代词缩写，挖掘属性形容词。 |
| **语气跳过** | Very nice. | [Very] | **[nice]** | 语气词无习得价值，挖实义形容词。 |
| **特殊情况** | Louise Taylor. | [Louise] | **(不挖空)** | 纯人名地名句无习得价值，直接显示原文。 |

---

## 4. 待执行任务
1. **重构脚本**：修改 reprocess_ietts_blanks.py  v4.1 逻辑，引入上述权重系统与黑名单。
2. **全量刷新**：使用新逻辑更新 刚才以 reprocess_translation_v2.py 重新翻译好的5个素材的 `blanks` 字段。
3. **质量核验**：处理完后，请针对上述 5个素材给 7 个案例输出你修正后的结果，确保逻辑完全对齐。