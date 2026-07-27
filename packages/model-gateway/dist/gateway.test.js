import { describe, expect, it } from "vitest";
import { ModelGateway } from "./gateway.js";
function gateway(budget) {
    return new ModelGateway({
        mode: "remote",
        deepseekApiKey: "test",
        deepseekBaseUrl: "http://127.0.0.1:1",
        deepseekDefaultModel: "test",
        ollamaBaseUrl: "http://127.0.0.1:2",
        ollamaApiKey: "ollama",
        ollamaDefaultModel: "test",
        timeoutMs: 50,
        dailyRemoteTokenBudget: budget,
    });
}
describe("remote token budget", () => {
    it("blocks new remote requests when usage reaches the daily budget", () => {
        const subject = gateway(10);
        expect(subject.canUseRemote()).toBe(true);
        subject.addRemoteUsage(10);
        expect(subject.canUseRemote()).toBe(false);
    });
    it("does not affect local provider resolution", () => {
        const subject = gateway(0);
        expect(subject.canUseRemote()).toBe(false);
        expect(subject.resolveProviderForMode("ollama").id).toBe("ollama");
    });
});
//# sourceMappingURL=gateway.test.js.map