import { describe, expect, it } from "vitest";
import { composePersonaPrompt } from "../src/composer.js";
import { confuciusSeed, pikachuSeed } from "../src/seeds/index.js";

describe("composePersonaPrompt", () => {
  it("includes persona name in composed prompt", () => {
    const prompt = composePersonaPrompt({
      personaName: confuciusSeed.name,
      personaVersion: confuciusSeed.version,
      relationship: { title: "席间问学", level: "熟悉" },
      memories: [{ category: "preference", content: "用户不喜欢被说教" }],
      summary: "用户正在讨论学习与自律。",
      retrievedKnowledge: ["《论语》谈学而时习，不把背诵当作学的全部。"],
      retrievedHistory: ["用户：我想改掉只背结论的习惯。"],
    });

    expect(prompt).toContain("孔子");
    expect(prompt).toContain("[平台规则]");
    expect(prompt).toContain("[角色身份]");
    expect(prompt).toContain("[表达方式]");
    expect(prompt).toContain("[当前关系]");
    expect(prompt).toContain("[长期记忆]");
    expect(prompt).toContain("[会话摘要]");
    expect(prompt).toContain("[检索到的角色知识]");
    expect(prompt).toContain("[相关较早对话]");
    expect(prompt).toContain("学而时习");
    expect(prompt).not.toContain(confuciusSeed.version.knowledge);
  });

  it("produces clearly different prompts for pikachu and confucius", () => {
    const pikachuPrompt = composePersonaPrompt({
      personaName: pikachuSeed.name,
      personaVersion: pikachuSeed.version,
    });
    const confuciusPrompt = composePersonaPrompt({
      personaName: confuciusSeed.name,
      personaVersion: confuciusSeed.version,
    });

    expect(pikachuPrompt).toContain("皮卡丘");
    expect(confuciusPrompt).toContain("孔子");

    expect(pikachuPrompt).toContain("皮卡");
    expect(confuciusPrompt).not.toContain("皮卡");

    expect(confuciusPrompt).toContain("仁");
    expect(pikachuPrompt).not.toContain("《论语》");

    const overlap =
      pikachuPrompt.length > 0 &&
      confuciusPrompt.length > 0 &&
      pikachuPrompt === confuciusPrompt;
    expect(overlap).toBe(false);

    expect(pikachuSeed.version.systemPrompt).not.toEqual(
      confuciusSeed.version.systemPrompt,
    );
  });
});
