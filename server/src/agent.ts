import { query, createSdkMcpServer, type Options } from "@anthropic-ai/claude-agent-sdk";
import { searchDocuments, getDocument } from "./tools/documents.js";
import { findRelated, getConnections } from "./tools/graph.js";
import { searchCases } from "./tools/cases.js";
import { searchTimeline } from "./tools/timeline.js";
import { searchEntities } from "./tools/entities.js";
import { getStats, getResearchCorrelations } from "./tools/stats.js";

// All tool definitions for reference
const allTools = [
  searchDocuments,
  getDocument,
  findRelated,
  getConnections,
  searchCases,
  searchTimeline,
  searchEntities,
  getStats,
  getResearchCorrelations,
];

// Tool names for allowedTools (prefixed with mcp server name)
export const toolNames = allTools.map(
  (t) => `mcp__uap-data__${t.name}`
);

// Create the in-process MCP server with all tools
const uapDataServer = createSdkMcpServer({
  name: "uap-data",
  version: "1.0.0",
  tools: allTools,
});

const SYSTEM_PROMPT = `You are an investigative research assistant for the PURSUE UAP Document Explorer, a collection of 129 declassified U.S. government documents about unidentified aerial phenomena (UAP/UFO).

Your role:
- Help users explore, search, and understand the document collection
- Answer questions by searching the actual data using your tools — never fabricate document contents, entity names, or case details
- Cite specific document IDs (e.g., "Document #103: Apollo 11 Crew Debriefing") so users can click through to them
- Explain connections between documents, cases, entities, and events
- Provide historical context and help users understand the significance of findings
- When discussing redacted content, note what was redacted and what exemptions were cited, without speculating about redacted content

Available tools:
- search_documents: Full-text search across all documents
- get_document: Get detailed metadata, narrative, and entities for a specific document
- find_related: Find connected documents in the relationship graph
- get_connections: See the most-connected hub documents
- search_cases: Search curated high-interest cases (Nimitz, Roswell, etc.)
- search_timeline: Filter documents by year range and agency
- search_entities: Find organizations, people, and locations across documents
- get_stats: Get aggregate collection statistics
- get_research_correlations: Get background research and context about the PURSUE release

After answering, suggest 2-3 follow-up questions the user might want to ask.`;

/**
 * SSE event types emitted by the agent
 */
export interface AgentEvent {
  type: "session" | "text" | "tool_call" | "tool_result" | "done" | "error";
  sessionId?: string;
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  summary?: string;
  error?: string;
}

// Session history for multi-turn conversations
const sessions = new Map<string, string>();

/**
 * Run the agent with a user message and yield SSE events.
 */
export async function* runAgent(
  message: string,
  sessionId: string,
  pageContext?: string
): AsyncGenerator<AgentEvent> {
  // Build the prompt with optional page context
  let prompt = message;
  if (pageContext) {
    prompt = `[Page context: The user is currently on ${pageContext}]\n\n${message}`;
  }

  // Yield session info
  yield { type: "session", sessionId };

  try {
    // Check if we should resume a previous session
    const previousSessionId = sessions.get(sessionId);

    const queryOptions: Options = {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: { "uap-data": uapDataServer },
      allowedTools: toolNames,
      maxTurns: 10,
      tools: [], // Disable built-in tools (Read, Write, Bash, etc.) — only use our MCP tools
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
    };

    if (previousSessionId) {
      queryOptions.resume = previousSessionId;
    }

    const q = query({
      prompt,
      options: queryOptions,
    });

    let resultText = "";
    let sdkSessionId: string | undefined;

    for await (const msg of q) {
      if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
        sdkSessionId = (msg as { session_id: string }).session_id;
        // Store SDK session ID for future resume
        sessions.set(sessionId, sdkSessionId);
      }

      if (msg.type === "assistant" && "message" in msg) {
        const assistantMsg = msg as {
          message: {
            content: Array<
              | { type: "text"; text: string }
              | { type: "tool_use"; name: string; input: Record<string, unknown> }
            >;
          };
        };

        for (const block of assistantMsg.message.content) {
          if (block.type === "text" && block.text) {
            yield { type: "text", content: block.text };
            resultText += block.text;
          } else if (block.type === "tool_use") {
            // Strip the mcp__uap-data__ prefix for cleaner display
            const toolName = block.name.replace("mcp__uap-data__", "");
            yield {
              type: "tool_call",
              tool: toolName,
              input: block.input,
            };
          }
        }
      }

      // Tool results come back as user messages with tool_result content
      if (msg.type === "user" && "message" in msg) {
        const userMsg = msg as {
          message: {
            content: Array<{
              type: string;
              tool_use_id?: string;
              content?: string | Array<{ type: string; text: string }>;
            }>;
          };
        };
        if (userMsg.message?.content) {
          for (const block of userMsg.message.content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              // Summarize the tool result for the SSE stream
              let summary = "Completed";
              if (typeof block.content === "string") {
                try {
                  const parsed = JSON.parse(block.content);
                  if (parsed.total_matches !== undefined) {
                    summary = `Found ${parsed.total_matches} matches`;
                  } else if (parsed.matching !== undefined) {
                    summary = `Found ${parsed.matching} results`;
                  } else if (parsed.total_connections !== undefined) {
                    summary = `Found ${parsed.total_connections} connections`;
                  }
                } catch {
                  summary = `Returned ${block.content.length} characters`;
                }
              }
              yield { type: "tool_result", summary };
            }
          }
        }
      }

      if (msg.type === "result") {
        const resultMsg = msg as {
          subtype: string;
          result?: string;
          errors?: string[];
        };
        if (resultMsg.subtype === "success") {
          // If the result text differs from what we accumulated from assistant messages,
          // it means the SDK has a final consolidated answer
          if (resultMsg.result && resultMsg.result !== resultText) {
            yield { type: "text", content: resultMsg.result };
          }
        } else {
          yield {
            type: "error",
            error:
              resultMsg.errors?.join("; ") ||
              `Agent ended with status: ${resultMsg.subtype}`,
          };
        }
      }
    }

    yield { type: "done" };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    yield { type: "done" };
  }
}
