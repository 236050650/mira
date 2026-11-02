export type EvalQuestion = {
  personaName: string;
  personaId: string;
  query: string;
  expectedSourceIds: string[];
  category: "knowledge" | "memory" | "boundary";
};

export const evalQuestions: EvalQuestion[] = [
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "河西之战你是怎么打的？",
    expectedSourceIds: ["huo-qubing-v1#k-riverwest-campaign"],
    category: "knowledge",
  },
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "你为什么不修建府邸？",
    expectedSourceIds: ["huo-qubing-v1#k-no-mansion"],
    category: "knowledge",
  },
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "匈奴未灭这句话的出处是什么？",
    expectedSourceIds: ["huo-qubing-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "你认为仁是什么？",
    expectedSourceIds: ["confucius-v1#k-ren-concept"],
    category: "knowledge",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "你周游列国的经历如何？",
    expectedSourceIds: ["confucius-v1#k-travels"],
    category: "knowledge",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "你有多少学生？",
    expectedSourceIds: ["confucius-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "心学的核心思想是什么？",
    expectedSourceIds: ["wang-yangming-v1#k-xin-xue"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "龙场悟道发生了什么？",
    expectedSourceIds: ["wang-yangming-v1#k-longchang-enlightenment"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "你的军事才能如何？",
    expectedSourceIds: ["wang-yangming-v1#k-military"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "你和朱熹的学说有什么区别？",
    expectedSourceIds: ["wang-yangming-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "皮卡丘",
    personaId: "pikachu",
    query: "你最喜欢吃什么？",
    expectedSourceIds: ["pikachu-v1#k-favorite-food"],
    category: "knowledge",
  },
  {
    personaName: "皮卡丘",
    personaId: "pikachu",
    query: "你的电击技能是怎样的？",
    expectedSourceIds: ["pikachu-v1#k-thunderbolt"],
    category: "knowledge",
  },
  {
    personaName: "皮卡丘",
    personaId: "pikachu",
    query: "你和小智的关系如何？",
    expectedSourceIds: ["pikachu-v1#k-ash-relationship"],
    category: "knowledge",
  },
  {
    personaName: "爱因斯坦",
    personaId: "einstein",
    query: "相对论的基本原理是什么？",
    expectedSourceIds: ["einstein-v1#k-relativity"],
    category: "knowledge",
  },
  {
    personaName: "爱因斯坦",
    personaId: "einstein",
    query: "E=mc²这个公式的含义是什么？",
    expectedSourceIds: ["einstein-v1#k-mass-energy"],
    category: "knowledge",
  },
  {
    personaName: "爱因斯坦",
    personaId: "einstein",
    query: "你获得诺贝尔奖是因为什么？",
    expectedSourceIds: ["einstein-v1#k-nobel"],
    category: "knowledge",
  },
  {
    personaName: "爱因斯坦",
    personaId: "einstein",
    query: "量子力学的最新进展是什么？",
    expectedSourceIds: ["einstein-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "你最喜欢去哪里游历？",
    expectedSourceIds: ["li-bai-v1#k-travels"],
    category: "knowledge",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "你和杜甫的友谊是怎样的？",
    expectedSourceIds: ["li-bai-v1#k-du-fu"],
    category: "knowledge",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "你为什么被称为诗仙？",
    expectedSourceIds: ["li-bai-v1#k-poet-immortal"],
    category: "knowledge",
  },
];
