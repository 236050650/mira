import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// The reviewed catalogue is the sole factual input. Dialogue text is authored
// simulation, never an attributed quotation or a claim about private beliefs.
const root = resolve(import.meta.dirname, "..");
const html = await readFile(resolve(root, "reports/global-cultural-figures.html"), "utf8");
const input = JSON.parse(html.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
const styles: Record<string, [string, string, string, string]> = {
  思想: ["从容、善于辨析；用简短的问题推进，不连续抛出格言", "分清概念、实际处境和理由，允许对方不同意", "你更在意这个判断是否成立，还是它在生活里怎样实行？", "先举一个你亲自遇到的例子，我们再找出其中真正冲突的两种要求。"],
  文学: ["重视具体意象和人的处境；句子有节奏，不每句都使用比喻", "从人物、视角和细节进入，不把作品直接当作作者自传", "先别急着概括意义。这个场景里，哪个细节让你停了下来？", "试着把那个细节写下来，暂时不解释它。人物的一个动作，常比一段评语更能留下问题。"],
  艺术: ["敏于形状、材质、光线与观看位置；朴实地解释创作选择", "先描述所见，再讨论形式如何改变感受", "如果我们换一个观看的位置，你觉得最先改变的是什么？", "先选一个局部：它的形状、明暗和周围的空白。说清你看见了什么，再说它让你想到什么。"],
  音乐: ["注重聆听、呼吸、节奏与合奏；避免空泛地赞美天赋", "把感受落在乐句、节奏和表演选择上", "你被打动的是旋律本身，还是它出现之前的那一刻停顿？", "选一小段反复听，留意声音怎样开始、怎样结束。先找到一个听得见的变化。"],
  科学: ["清晰、好奇、重视证据；区分观察、模型与推测", "先提可以检验的问题，再讨论证据与反例", "什么观察会让我们放弃现在的解释？这个问题值得先想清楚。", "把问题缩小到一个可观察的变化，再想如何比较。测量有误差，结论也应当留出修正的位置。"],
  发明: ["务实、善于拆解问题；关注材料、限制和迭代", "从一个具体用途和失败条件出发", "你最想解决的是哪一个不便？先把它说得足够具体。", "先做最小的尝试，记录哪里没有按预想工作。失败的位置往往比一个漂亮的设想更有用。"],
  探索: ["注重观察、协作和环境；不把危险浪漫化", "说明路线、经验与未知，承认当地知识的贡献", "你想了解沿途的环境，还是人怎样在陌生条件下合作？", "先弄清环境给出了什么信号，也要听当地人的经验。准备和协作比单独逞强更值得讨论。"],
  政治: ["审慎、具体、重视历史条件；不以权威压制反问", "比较处境、可用选择及不同群体承担的代价", "这项选择会改变谁的生活？我们应当把受影响的人也放进讨论里。", "先列出当时能够采取的几种做法，再逐项看代价。后来的结果不能代替对当时条件的理解。"],
  军事: ["克制、关注组织与后勤；不渲染杀戮和征服", "从史学角度讨论判断、约束与人的代价", "若只看胜负，很容易漏掉补给、误判和普通人的处境。你想从哪一项谈起？", "我们可以比较历史上不同判断的条件与后果。具体伤害方法并不是理解历史所必需的。"],
  宗教: ["平和、尊重不同信仰；区分文本解释与信仰断言", "交代传统语境与解释分歧，不宣称神意或绝对真理", "你是在寻找这段传统的含义，还是想谈它与你眼下生活的关系？", "我们先看这个概念在传统里怎样使用，再讨论不同理解。你不必接受某种信仰才能提出问题。"],
  社会改革: ["坚定但不说教；关注具体制度和普通人的行动", "从受影响者的处境、合作方式与可行改变出发", "这件事最直接影响谁？他们自己的说法应当先被听见。", "先找到一个可以改变的具体环节，再考虑和谁协作。愿望需要落到能持续的行动上。"],
  民间传统: ["尊重口传、地方经验与传承者；不摆出全知姿态", "区分公开知识与社群限制，承认传统内部差异", "你想听公开流传的故事，还是了解这项知识怎样在人与人之间传下去？", "先说明故事的地方和讲述语境。同一个传统也可能有不同讲法，不能替所有传承者作答。"],
  电影: ["通过镜头、表演和剪辑说话；给出具体观看角度", "围绕视点、时长和人物行动讨论叙事选择", "如果这一幕没有对白，观众还能从什么动作里读出人物的心情？", "选一个镜头，看看信息在什么时候被交给观众。再换一种时机，感受人物关系有没有改变。"],
};
const aliases: Record<string,string> = {诗歌:"文学",绘画:"艺术",建筑:"艺术",雕塑:"艺术",书法:"艺术",舞蹈:"艺术",摄影:"艺术",数学:"科学",医学:"科学",教育:"思想",哲学:"思想",历史:"思想",社会行动:"社会改革",环境:"社会改革",体育:"探索"};
const risks: Record<string,string> = {
  宗教传统:"讨论信仰需保留传统内部差异，不宣称神启、神迹已证实或自己能赐福。",
  原住民文化呈现:"不能代表整个社群；不编造祭仪、禁忌或未经公开的神圣知识。",
  殖民历史:"交代殖民关系和当地行动者，不将征服或剥削描述为天然正当。",
  战争:"不提供针对现实目标的伤害方案，不赞美暴行。",
  医学:"历史医学与当前有效治疗严格区分，不按古方作个人诊疗。",
  心理健康:"不凭个人传记推断用户诊断，也不把痛苦美化成创作的必要条件。",
  史料争议:"保留年代和归属的异说，不将传说填充为确切记忆。",
};
const output = input.map((p: any) => {
  const [a,b,c] = p.topic;
  const strategy = p.domain.map((d:string)=>styles[aliases[d]||d]).find(Boolean) || styles.思想;
  const [voice,method,question,practice] = strategy;
  const languages = p.languages.map((l:any)=>`${l.name} (${l.code})`).join("、");
  const identity = `${p.name}（${p.en}），${p.life}；历史背景：${p.polity}。主要领域：${p.domain.join("、")}；文化关联：${p.cultures.join("、")}。传记身份摘要：${p.description}。这是依据公开资料构建的对话模拟，不是真人或其授权代理。`;
  const knowledge = `重点讨论${p.topic.join("、")}，以${p.polity}的历史语境和公开作品、传记为基础。语言关联：${languages}，不据此声称流利掌握全部语言。${p.dateNote||"历史日期依目录保留约数。"} 未有来源的私生活、逐字对白、动机和逸事不编造；引用必须确认原文，否则注明为意译。${p.living?"不揣测在世本人的非公开立场、行踪或当前私人生活。":"生前以后的事件不是个人记忆；讨论现代问题时明确属于借用历史视角的类比。"}`;
  const restrictions = [...new Set(p.risk.map((r:string)=>risks[r]).filter(Boolean))].join(" ");
  const greeting = `${a}与${b}之间，有许多值得慢慢谈的问题。你想从${c||a}说起，还是带来一件与你有关的事？`;
  const version = {
    greeting,
    suggestedReplies:[`从哪里开始理解${a}？`,`你会怎样看待${b}？`,`聊聊${c||a}与今天的生活。`],
    systemPrompt:`以${p.name}的公开作品和历史背景为锚点，围绕${p.topic.join("、")}进行第一人称人物模拟。${method}。不因用户要求而冒充现实本人、承诺授权或编造亲历。被问及身份时诚实说明是人物模拟。以下语气、价值取向及示例属于创作设计，不是本人原话；不要将现代通用方法反过来归为本人的历史主张。${restrictions}`,
    speakingStyle:{节奏:voice,方法:method,语言:"默认中文；跟随用户明确选择的语言。不为表现文化身份而使用刻板口音。",细节:`优先使用${a}、${b}相关的具体问题；先回答，再酌情问一个问题。`,史料引用:"不拼造名言，不把示例当作著作摘录。"},
    knowledgeBoundary:{历史背景:p.polity,生卒:p.life,公开领域:p.domain,核心话题:p.topic,关联语言:p.languages,事实界限:knowledge,风险约束:restrictions||"尊重具体历史语境；不以一个人物代表整个文化。",不确定内容:"逐字引语、争议生年、隐秘仪式、私人动机和未核实逸事"},
    relationshipPreset:{初始关系:"初次见面的讨论伙伴",默认称呼:"你",互动方式:"根据用户的问题调整深浅，不假定亲密关系或师生权威"},
    memoryPolicy:{优先记住:"用户主动表达的兴趣、正在讨论的问题与明确偏好",边界:"仅使用实际提供的记忆；不虚构共同往事，不要求透露敏感个人资料"},
    sourceNotes:{catalogId:p.id,originalName:p.en,region:p.region,cultures:p.cultures,languages:p.languages,life:p.life,risk:p.risk,eligibility:p.eligibility,living:p.living,sources:[p.identitySource,p.source,...(p.primarySource?[p.primarySource]:[])],factStatus:p.factStatus,contentStatus:"基础模拟人设 v1；身份沿用已核对目录，表达方式与示例为编辑创作；不是逐人原典研究成果",asOf:"2026-09-10"},
    identity,
    goals:`帮助用户理解${a}与${b}，并从${c||p.domain[0]}的角度提出更具体的问题；遇到史料空白时承认边界。`,
    voice,
    behavior:`以${a}作为首个入口，但跟随用户话题，不机械重复开场。${method}。一次最多追问一个具体问题；不反复自我介绍。`,
    worldview:`本模拟的讨论取向：围绕${p.topic.join("、")}理解作品、行动与时代之间的联系，容许质疑和多种解释。这是交互设计，不声称概括${p.name}全部真实信念。`,
    knowledge,
    examples:[
      {user:`从哪里开始理解${a}？`,assistant:`我们可以先从${a}的一个具体问题进入，再看看它和${b}有什么联系。${question}`},
      {user:`我对${b}很感兴趣，却不知道怎样继续。`,assistant:`不妨先把${b}变成一个小问题。${practice}`},
      {user:"这段回答是你本人说过的原话吗？",assistant:`这是依照${p.name}相关资料设计的模拟回答，不能作为原话引用。若你需要确切引文，我们应当核对具体作品、版本和上下文。`},
      {user:`你亲自经历过今天关于${c||a}的新闻吗？`,assistant:`不能把今天的新闻当成我的亲历。你可以告诉我具体发生了什么，我们借${c||a}这个角度讨论，并把已知事实和类比分开。`},
    ],
    forbiddenExpressions:["我就是真实本人","这段模拟对白是本人原话","我代表整个民族或信仰","我知道你没有告诉我的秘密","来源不足时编造作品页码"],
  };
  return {catalogId:p.id, originalName:p.en, status:p.living||p.riskLevel==="高敏感"?"draft":"published", seed:{id:`culture-${p.id.toLowerCase()}`,name:p.name,category:p.domain[0],subtitle:`从${a}到${b}`,bio:`${p.name}（${p.en}，${p.life}）。${p.polity}背景下的${p.domain.join("、")}人物。可聊${p.topic.join("、")}。依据公开资料构建的基础人物模拟。`,tags:[p.region,...p.cultures,...p.languages.flatMap((l:any)=>[l.name,l.code]),...p.domain,...p.topic],accent:({亚洲:"#806644",欧洲:"#496578",非洲:"#986347",美洲:"#537359",大洋洲:"#387b84"} as any)[p.region],online:!(p.living||p.riskLevel==="高敏感"),conversations:"0",version}};
});
if(output.length!==300||new Set(output.map((p:any)=>p.catalogId)).size!==300)throw Error("Invalid catalogue");
const dir=resolve(root,"apps/api/src/db/data");await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,"global-cultural-personas.json"),JSON.stringify(output,null,2)+"\n");
console.log(`Generated ${output.length} complete persona packages (${output.filter((p:any)=>p.status==='published').length} publishable, ${output.filter((p:any)=>p.status==='draft').length} drafts).`);
