import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { runAgent, toolNames } from "./agent.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[server] ANTHROPIC_API_KEY is not set. The chat agent will not work.");
  console.error("[server] Set it with: export ANTHROPIC_API_KEY=sk-ant-...");
}

const app = express();
const PORT = 3001;

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://enge:4173",
      "http://enge:5173",
      "http://100.111.185.11:4173",
      "http://100.111.185.11:5173",
    ],
    credentials: true,
  })
);

app.use(express.json());

/**
 * Health check endpoint
 */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    tools: toolNames.map((t) => t.replace("mcp__uap-data__", "")),
    version: "1.0.0",
  });
});

/**
 * Chat endpoint — Server-Sent Events
 *
 * Body: { message: string, sessionId?: string, pageContext?: string }
 *
 * Streams SSE events:
 *   data: {"type":"session","sessionId":"..."}
 *   data: {"type":"text","content":"..."}
 *   data: {"type":"tool_call","tool":"search_documents","input":{...}}
 *   data: {"type":"tool_result","tool":"search_documents","summary":"Found N documents"}
 *   data: {"type":"done"}
 */
app.post("/api/chat", async (req, res) => {
  const { message, sessionId: clientSessionId, pageContext } = req.body as {
    message?: string;
    sessionId?: string;
    pageContext?: string;
  };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    return;
  }

  // Generate or reuse session ID
  const sessionId = clientSessionId || uuidv4();

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Track if client disconnected
  let disconnected = false;
  req.on("close", () => {
    disconnected = true;
  });

  try {
    const agentStream = runAgent(message.trim(), sessionId, pageContext);

    for await (const event of agentStream) {
      if (disconnected) break;

      const data = JSON.stringify(event);
      res.write(`data: ${data}\n\n`);

      // Flush if available (for express 5 compatibility)
      if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
        (res as unknown as { flush: () => void }).flush();
      }
    }
  } catch (error) {
    if (!disconnected) {
      const errorData = JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      res.write(`data: ${errorData}\n\n`);
    }
  } finally {
    if (!disconnected) {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`[server] UAP Agent Server running on http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[server] Chat endpoint: POST http://localhost:${PORT}/api/chat`);
});
