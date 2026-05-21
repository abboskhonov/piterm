export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp?: number;
  thinking?: string;
  modelName?: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    output?: string;
    isError?: boolean;
    streaming?: boolean;
  }>;
  streaming?: boolean;
  /** Base64 data URLs for attached images */
  images?: string[];
}

export interface SessionEvent {
  type: string;
  [key: string]: unknown;
}

export function applySessionEvent(
  messages: ChatMessage[],
  event: SessionEvent,
  currentModelName?: string | null
): ChatMessage[] {
  switch (event.type) {
    case "message_start": {
      const msg = event.message as {
        role: string;
        content?: unknown;
        timestamp?: number;
      };
      if (msg.role === "user") {
        return [
          ...messages,
          {
            id: `u-${crypto.randomUUID()}`,
            role: "user",
            text: contentToText(msg.content),
            images: contentToImages(msg.content),
          },
        ];
      }
      if (msg.role === "assistant") {
        return [
          ...messages,
          {
            id: `a-${crypto.randomUUID()}`,
            role: "assistant",
            text: "",
            streaming: true,
            modelName: currentModelName || undefined,
            toolCalls: [],
          },
        ];
      }
      return messages;
    }

    case "message_delta":
    case "message_update": {
      const last = messages.at(-1);
      if (!last || last.role !== "assistant") return messages;

      const assistantEvent = event.assistantMessageEvent as
        | { type: string; delta?: string }
        | undefined;

      if (assistantEvent?.type === "text_delta" && assistantEvent.delta) {
        const next = [...messages];
        next[next.length - 1] = {
          ...last,
          text: last.text + assistantEvent.delta,
        };
        return next;
      }
      if (assistantEvent?.type === "thinking_delta" && assistantEvent.delta) {
        const next = [...messages];
        next[next.length - 1] = {
          ...last,
          thinking: (last.thinking ?? "") + assistantEvent.delta,
        };
        return next;
      }
      return messages;
    }

    case "message_end": {
      const last = messages.at(-1);
      if (last?.role !== "assistant") return messages;
      const next = [...messages];
      next[next.length - 1] = {
        ...last,
        streaming: false,
      };
      return next;
    }

    case "tool_execution_start": {
      const last = messages.at(-1);
      if (!last || last.role !== "assistant") return messages;
      const next = [...messages];
      next[next.length - 1] = {
        ...last,
        toolCalls: [
          ...(last.toolCalls ?? []),
          {
            toolCallId: (event.toolCallId as string) ?? "",
            toolName: (event.toolName as string) ?? "tool",
            args: (event.args ?? {}) as Record<string, unknown>,
            output: "",
            isError: false,
            streaming: true,
          },
        ],
      };
      return next;
    }

    case "tool_execution_update": {
      const last = messages.at(-1);
      if (!last || last.role !== "assistant") return messages;
      const toolCallId = event.toolCallId as string;
      const output = resultText(event.partialResult);
      const next = [...messages];
      next[next.length - 1] = {
        ...last,
        toolCalls: (last.toolCalls ?? []).map((card) =>
          card.toolCallId === toolCallId ? { ...card, output } : card
        ),
      };
      return next;
    }

    case "tool_execution_end": {
      const last = messages.at(-1);
      if (!last || last.role !== "assistant") return messages;
      const toolCallId = event.toolCallId as string;
      const output = resultText(event.result);
      const next = [...messages];
      next[next.length - 1] = {
        ...last,
        toolCalls: (last.toolCalls ?? []).map((card) =>
          card.toolCallId === toolCallId
            ? { ...card, output, isError: !!event.isError, streaming: false }
            : card
        ),
      };
      return next;
    }

    default:
      return messages;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function contentToImages(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) return undefined;
  const images: string[] = [];
  for (const part of content) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type?: string }).type === "image" &&
      "data" in part &&
      "mimeType" in part
    ) {
      const p = part as { data: string; mimeType: string };
      images.push(`data:${p.mimeType};base64,${p.data}`);
    }
  }
  return images.length > 0 ? images : undefined;
}

function resultText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "output" in result) {
    return String((result as { output?: unknown }).output ?? "");
  }
  return "";
}
