import "server-only";

/**
 * OpenAI 호환 Chat Completions API 하나로 모든 AI 백엔드를 다룬다.
 * - 개발: 로컬 Ollama (http://127.0.0.1:11434/v1)
 * - 운영: 클라우드 호스팅 API (OpenRouter, DeepInfra, Alibaba Model Studio 등)
 * 환경변수 AI_BASE_URL / AI_API_KEY / AI_MODEL / AI_TEXT_MODEL(브리핑용, 선택) 로 전환한다.
 */

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export class AIError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AIError";
  }
}

type AIConfig = { baseUrl: string; apiKey?: string; model: string; textModel: string; extraBody: object };

export function aiConfig(): AIConfig | null {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, "");
  const model = process.env.AI_MODEL;
  if (!baseUrl || !model) return null;
  return {
    baseUrl,
    apiKey: process.env.AI_API_KEY || undefined,
    model,
    textModel: process.env.AI_TEXT_MODEL || model,
    extraBody: parseExtraBody(),
  };
}

function requireConfig(): AIConfig {
  const config = aiConfig();
  if (!config) throw new AIError("AI 설정(AI_BASE_URL, AI_MODEL)이 없습니다.", false);
  return config;
}

function headers(config: AIConfig) {
  return {
    "content-type": "application/json",
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    // OpenRouter 대시보드에 앱 이름으로 표시됨 (다른 제공자는 무시)
    "x-title": "C:AI:ender",
  };
}

async function post(config: AIConfig, body: object, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify({ ...config.extraBody, ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new AIError(`AI 서버에 연결하지 못했습니다: ${(e as Error).message}`, true);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new AIError(`AI 서버 오류 ${res.status}: ${text.slice(0, 300)}`, retryable);
  }
  return res;
}

/** JSON 스키마를 강제한 응답을 받아 파싱한다 */
export async function generateJson<T = unknown>(opts: {
  messages: ChatMessage[];
  schema: object;
  schemaName: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** 이 요청만 다른 모델을 먼저 쓴다 (실패하면 OpenRouter가 기본 모델로 넘어간다) */
  model?: string;
}): Promise<{ data: T; model: string }> {
  const config = requireConfig();
  const res = await post(
    config,
    {
      model: opts.model ?? config.model,
      ...(opts.model && opts.model !== config.model ? { models: [opts.model, config.model] } : {}),
      messages: opts.messages,
      temperature: 0,
      max_tokens: opts.maxTokens ?? 2000,
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    },
    opts.timeoutMs ?? 240_000,
  );
  const json = await res.json();
  const content: string | undefined = json.choices?.[0]?.message?.content;
  if (!content) throw new AIError("AI 응답이 비어 있습니다.", true);
  try {
    return { data: JSON.parse(stripFence(content)) as T, model: json.model ?? config.model };
  } catch {
    throw new AIError(`AI 응답이 올바른 JSON이 아닙니다: ${content.slice(0, 200)}`, true);
  }
}

/** 일반 텍스트 응답 */
export async function generateText(opts: {
  messages: ChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; model: string }> {
  const config = requireConfig();
  const res = await post(
    config,
    { model: config.textModel, messages: opts.messages, temperature: 0.3, max_tokens: opts.maxTokens ?? 1000 },
    opts.timeoutMs ?? 120_000,
  );
  const json = await res.json();
  const text: string | undefined = json.choices?.[0]?.message?.content;
  if (!text) throw new AIError("AI 응답이 비어 있습니다.", true);
  return { text, model: json.model ?? config.textModel };
}

/**
 * 제공자별 추가 요청 옵션 (JSON). 예: OpenRouter 업체 우선순위
 *   AI_EXTRA_BODY={"provider":{"order":["novita","parasail"],"allow_fallbacks":true}}
 */
function parseExtraBody(): object {
  const raw = process.env.AI_EXTRA_BODY;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.error("AI_EXTRA_BODY가 올바른 JSON이 아닙니다. 무시합니다.");
    return {};
  }
}

function stripFence(s: string) {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}
