# 雅思听力素材翻译引擎重构协议

## 1. 核心任务目标
重构 `reprocess_ietts_blanks.py` 中的翻译逻辑，利用全文本语境（Full Context）和少量样本学习（Few-Shot）彻底根除“机翻感”和“逻辑断层”。

## [cite_start]2. 场景化翻译规范 
### A. 生活服务类 (Part 1/2)
- **基调**：礼貌、专业。统一使用“您”。
- [cite_start]**术语规范**：`sit-down meal` -> 桌餐 [cite: 7][cite_start]；`facilities` -> 场地 [cite: 10]；`first floor` -> 二楼（英制）。

### B. 医疗/专业咨询类
- **基调**：严谨、专业关怀。
- **术语规范**：`What brought you here` -> 能跟我说说您今天来就诊的原因吗？；`aware of pain` -> 感觉到疼痛。

### C. 学术讨论类 (Part 3)
- **基调**：干练、研讨式、逻辑紧密。
- [cite_start]**术语规范**：`information/material` -> 资料/素材 [cite: 2][cite_start]；`get in touch` -> 联系 [cite: 5][cite_start]；`section` -> 章节 [cite: 6]。

### D. 讲座科普类 (Part 4)
- **基调**：书面、庄重、学术感。
- [cite_start]**术语规范**：`observe the skies` -> 观测天象 [cite: 14][cite_start]；`held sway` -> 占据主导地位 [cite: 12][cite_start]；`weather patterns` -> 气候规律 [cite: 12]。

## [cite_start]3. 完美范例参考库 
关于课题研究 (Research/Materials)：
* 原文: "The discovery of the mammoth tooth is probably the most dramatic part, but we don't have that much information, only what we got from the online article."
* 完美翻译: “发现猛犸象牙齿的过程确实是最具戏剧性的部分，但我们掌握的信息有限，仅限于从那篇网络文章中获取的内容。”
    * 改进点：将 dramatic 译为戏剧性，将 information 译为信息/内容，避免使用“那事儿/点东西”。

关于资料准备 (Materials/Data)：
* 原文: "We've got a lot on that, but we need to make it interesting."
* 完美翻译: “关于这部分的资料我们准备得很充实，但我们需要把它呈现得更有趣一点。”
    * 改进点：将 got a lot on that 译为资料充实，将 make it interesting 译为呈现得有趣。

关于演示互动 (Presentation/Audience)：
* 原文: "We could ask the audience to suggest some questions about it and then see how many of them we can answer."
* 完美翻译: “我们可以邀请观众针对这部分进行提问，然后看看我们能回答多少。”
    * 改进点：将 ask the audience 译为邀请观众提问，语气更符合学术演示（Presentation）背景。

关于专家访谈 (Expert/Interview)：
* 原文: "I thought maybe we could get in touch with the researcher who led the team and ask him to tell us a bit more."
* 完美翻译: “我想，也许我们可以联系一下带队的研究员，请他分享更多研究细节。”
    * 改进点：将 tell us a bit more 译为分享更多研究细节，体现专业性。

关于环节讨论 (Section/Structure)：
* 原文: "What about the section with the initial questions asked by the researchers?"
* 完美翻译: “那关于‘研究人员最初提出的问题’这一章节呢？”
    * 改进点：明确 Section 是章节/环节，Initial 是最初/起始。

餐饮预订场景（术语+价格逻辑）：
* 原文: "Will you be having a sit-down meal or a buffet? ... That's $45 per person. Or you can have the special for $25 more."
* 完美翻译: “您的用餐形式是准备选桌餐还是自助餐？……价格是每位 45 美元。或者您也可以每人额外增加 25 美元，升级为我们的特色套餐。”

长句逻辑重组（开场白语境）：
* 原文: "Now I'd like to tell you what some of our volunteers have said about what they do to give you an idea of the range of ways in which they can help people."
* 完美翻译: “接下来，我想分享几位志愿者的心得，让大家了解一下他们平时的工作内容，以及我们可以通过哪些不同的方式来帮助他人。”

人物与状态描述（去机翻腔）：
* 原文: "Our volunteer, Consuela, is an amazing woman. She has difficulty walking herself, but she doesn't let that stop her."
* 完美翻译: “我们的志愿者康苏埃拉是一位非常了不起的女性。尽管她本人行动不便，但这丝毫没有阻碍她助人的热情。”

会务场地咨询（术语纠偏）：
* 原文: "Uh, let me see. Our conference facilities are already booked for the weekend beginning January 28th."
* 完美翻译: “嗯，我帮您查一下。1月28日那个周末，我们的会议场地已经全部被订满了。”

日常对话指代（语境理解）：
* 原文: "What sort of price are we looking at for that? ... Yes. I really don't like it when you can't talk."
* 完美翻译: “那这项服务的费用大约是多少？……没错，我真的很讨厌那种吵到没法聊天的情况。”

讲座/科普场景

原文: "Generally, weather was attributed to the whims of the gods."
完美翻译: “通常情况下，天气的变化被归因于众神的意志。”（whims 译为意志/喜怒无常，比“任性”更专业）
原文: "In order to make the weather gods look kindly on them."
完美翻译: “……以此祈求气象神祇的眷顾。”
原文: "Observing the skies and drawing the correct conclusions... their survival depended on it."
完美翻译: “观测天象并从中得出正确的结论至关重要。事实上，这关系到他们的生存大计。”
原文: "Aristotle... his ideas held sway for nearly 2000 years."
完美翻译: “亚里士多德的贡献尤为显著，他的学术观点在近两千年的时间里一直占据着主导地位。”
“The Chinese also recognized weather patterns.”  完美翻译“古代中国也已掌握了天气的规律。”

## 4. 强制负面禁令
1. [cite_start]**禁代词拟人化**：严禁出现“不让那阻止她”、“注意到它” [cite: 9]。
2. [cite_start]**禁垃圾口语词**：严禁出现“那事儿”、“点东西”、“那块儿”、“那点东西”、“啥时候” [cite: 2]。
3. [cite_start]**禁低质直译**：严禁将 `give you an idea` 译为“给你个印象”，应译为“让大家了解” [cite: 8]。
4. [cite_start]**禁数学逻辑模糊**：`$25 more` 必须体现“加价/额外增加”逻辑 [cite: 7]。

## 5. 执行要求
1. **Context-Aware**：翻译单句时必须加载该 Part 的整段文本作为上下文。
2. **确认机制**：请先输出 5 句包含不同场景的样板，由我确认调性后方可执行全量覆盖。

## 6. 多语言对齐要求 (Multi-language Alignment)
- **繁体中文 **：
  - 基于高标准简中翻译进行转换，确保用词符合港台阅读习惯。
  - 范例：`Buffet` -> **自助餐**；`First floor` -> **二樓**。
- **越南语 **：
  - 保持与中文版一致的专业度与语境感。
  - 身份设定：雅思学术翻译专家。
  - 核心要求：严禁直译代词，确保长句符合越南语的表达逻辑（类似中文的重组要求）。
- **同步性**：所有语言的翻译必须基于同一段“全语境文本 (Full Context)”生成，确保语义逻辑在三种语言间完全统一。