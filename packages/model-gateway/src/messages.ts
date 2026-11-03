import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatMessage } from "./types.js";

export function chatMessageToLangChain(message: ChatMessage): BaseMessage {
  switch (message.role) {
    case "system":
      return new SystemMessage(message.content);
    case "user":
      return new HumanMessage(message.content);
    case "assistant":
      return new AIMessage(message.content);
    case "tool":
      return new HumanMessage(`[tool]\n${message.content}`);
    default:
      return new HumanMessage(message.content);
  }
}

export function chatMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
  return messages.map(chatMessageToLangChain);
}

export function langChainToChatMessages(messages: BaseMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => ("text" in part ? part.text : JSON.stringify(part)))
            .join("");
    const type = message.getType();
    if (type === "system") return { role: "system", content };
    if (type === "ai") return { role: "assistant", content };
    if (type === "tool") return { role: "tool", content };
    return { role: "user", content };
  });
}
