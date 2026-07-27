export type SseEventName =
  | "message.accepted"
  | "message.delta"
  | "message.usage"
  | "message.completed"
  | "message.failed";

export type MessageAcceptedEvent = {
  userMessageId: string;
  assistantMessageId: string;
  generationId: string;
};

export type MessageDeltaEvent = {
  assistantMessageId: string;
  delta: string;
};

export type MessageUsageEvent = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  provider: string;
  model: string;
};

export type MessageCompletedEvent = {
  assistantMessageId: string;
  finishReason: string;
};

export type MessageFailedEvent = {
  code: string;
  message: string;
};
