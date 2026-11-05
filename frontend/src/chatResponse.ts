export async function readChatReply<T>(
  response: Response,
  onProgress: () => void,
): Promise<T> {
  if (!response.ok) throw new Error("Request failed");
  if (
    !response.headers?.get("content-type")?.includes("application/x-ndjson")
  ) {
    return response.json();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response stream");

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress") onProgress();
        if (event.type === "reply" && event.reply) return event.reply as T;
        if (event.type === "error") throw new Error("Request failed");
      }
      if (done) throw new Error("Incomplete response stream");
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
