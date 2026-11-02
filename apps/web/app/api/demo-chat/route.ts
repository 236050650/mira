type DemoChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DemoChatBody = {
  persona?: {
    name?: string;
    subtitle?: string;
    intro?: string;
    relation?: string;
  };
  history?: DemoChatMessage[];
  message?: string;
};

type RuntimeEnv = {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_DEFAULT_MODEL?: string;
};

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_ITEMS = 12;

const RATE_LIMIT_PER_IP = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DAILY_GLOBAL_LIMIT = 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const ipRequests = new Map<string, { count: number; resetAt: number }>();
let globalDailyCount = 0;
let globalDailyResetAt = Date.now() + DAILY_WINDOW_MS;

function getClientIP(request: Request): string {
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  const xForwardedFor = request.headers.get("x-forwarded-for");
  const xRealIP = request.headers.get("x-real-ip");
  
  if (cfConnectingIP) return cfConnectingIP;
  if (xForwardedFor) return xForwardedFor.split(",")[0]?.trim() || "unknown";
  if (xRealIP) return xRealIP;
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  if (now >= globalDailyResetAt) {
    globalDailyCount = 0;
    globalDailyResetAt = now + DAILY_WINDOW_MS;
  }
  
  if (globalDailyCount >= DAILY_GLOBAL_LIMIT) {
    return { 
      allowed: false, 
      reason: "今日 Demo 额度已用尽，请明日再试。生产环境需配置独立密钥。" 
    };
  }
  
  const record = ipRequests.get(ip);
  if (record) {
    if (now >= record.resetAt) {
      ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else if (record.count >= RATE_LIMIT_PER_IP) {
      return { 
        allowed: false, 
        reason: "请求过于频繁，请稍后再试。" 
      };
    } else {
      record.count++;
    }
  } else {
    ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }
  
  globalDailyCount++;
  return { allowed: true };
}

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as RuntimeEnv;
  } catch {
    return {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
      DEEPSEEK_DEFAULT_MODEL: process.env.DEEPSEEK_DEFAULT_MODEL,
    };
  }
}

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    return Response.json(
      { error: rateLimitResult.reason },
      { status: 429 },
    );
  }

  const runtime = await getRuntimeEnv();
  if (!runtime.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: "线上模型尚未配置，请稍后再试。" },
      { status: 503 },
    );
  }

  let body: DemoChatBody;
  try {
    body = (await request.json()) as DemoChatBody;
  } catch {
    return Response.json({ error: "请求内容无效。" }, { status: 400 });
  }

  const message = body.message?.trim().slice(0, MAX_MESSAGE_LENGTH);
  const personaName = body.persona?.name?.trim().slice(0, 80);
  if (!message || !personaName) {
    return Response.json({ error: "请输入消息并选择角色。" }, { status: 400 });
  }

  const history = (body.history ?? [])
    .filter(
      (item): item is DemoChatMessage =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        Boolean(item.content.trim()),
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));

  const systemPrompt = [
    `你正在进行“${personaName}”的人格模拟对话。`,
    body.persona?.subtitle ? `人物定位：${body.persona.subtitle.slice(0, 160)}` : "",
    body.persona?.intro ? `人物背景：${body.persona.intro.slice(0, 800)}` : "",
    body.persona?.relation ? `当前关系：${body.persona.relation.slice(0, 80)}` : "",
    "请始终使用自然、克制、有辨识度的中文回应，保持人物的知识边界、价值取向和说话方式。",
    "不要声称自己是真实人物，也不要捏造现实世界中的最新事实。若涉及历史争议，请承认不确定性。",
    "每次回复控制在 80 到 260 个汉字，优先回应用户当前问题，并自然推进对话。",
  ]
    .filter(Boolean)
    .join("\n");

  const baseUrl = (runtime.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
  const model = runtime.DEEPSEEK_DEFAULT_MODEL || "deepseek-chat";

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: message },
        ],
        thinking: { type: "disabled" },
        temperature: 0.82,
        max_tokens: 520,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return Response.json(
        {
          error:
            status === 429
              ? "远程模型当前繁忙或额度受限，请稍后再试。"
              : "远程模型暂时不可用，请稍后再试。",
        },
        { status },
      );
    }

    const payload = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return Response.json({ error: "模型没有返回有效内容。" }, { status: 502 });
    }

    return Response.json({ reply, provider: "deepseek", model });
  } catch {
    return Response.json(
      { error: "无法连接远程模型，请稍后再试。" },
      { status: 502 },
    );
  }
}
