export type EvalQuestion = {
  personaName: string;
  personaId: string;
  query: string;
  expectedSourceIds: string[];
  category: "knowledge" | "boundary" | "hard";
};

export const evalQuestions: EvalQuestion[] = [
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "西域战役的关键战术是什么？",
    expectedSourceIds: ["huo-qubing-v1#k0"],
    category: "knowledge",
  },
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "为何选择不建造私人府邸？",
    expectedSourceIds: ["huo-qubing-v1#k1"],
    category: "knowledge",
  },
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "这句名言的历史背景是什么？",
    expectedSourceIds: ["huo-qubing-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "霍去病",
    personaId: "huo-qubing",
    query: "匈奴战争的现代军事意义",
    expectedSourceIds: [],
    category: "hard",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "如何理解仁德的核心含义？",
    expectedSourceIds: ["confucius-v1#k0"],
    category: "knowledge",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "游历各国期间的主要经历？",
    expectedSourceIds: ["confucius-v1#k1"],
    category: "knowledge",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "门徒的具体数量和名单？",
    expectedSourceIds: ["confucius-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "孔子",
    personaId: "confucius",
    query: "对当代教育改革的看法",
    expectedSourceIds: [],
    category: "hard",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "心即理学说的要义何在？",
    expectedSourceIds: ["wang-yangming-v1#k0"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "贵州悟道的契机是什么？",
    expectedSourceIds: ["wang-yangming-v1#k1"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "平叛时展现的军事智慧？",
    expectedSourceIds: ["wang-yangming-v1#k2"],
    category: "knowledge",
  },
  {
    personaName: "王阳明",
    personaId: "wang-yangming",
    query: "理学派系的详细分歧",
    expectedSourceIds: ["wang-yangming-v1#boundary"],
    category: "boundary",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "最钟爱的游历目的地？",
    expectedSourceIds: ["li-bai-v1#k0"],
    category: "knowledge",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "与杜甫的交往情况？",
    expectedSourceIds: ["li-bai-v1#k1"],
    category: "knowledge",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "诗仙称号的由来？",
    expectedSourceIds: ["li-bai-v1#k2"],
    category: "knowledge",
  },
  {
    personaName: "李白",
    personaId: "li-bai",
    query: "对现代自由诗的评价",
    expectedSourceIds: [],
    category: "hard",
  },
];
