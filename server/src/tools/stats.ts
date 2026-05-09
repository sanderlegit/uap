import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { stats, research } from "../data/loader.js";

/**
 * get_stats — Get aggregate statistics about the document collection.
 */
export const getStats = tool(
  "get_stats",
  "Get aggregate statistics about the UAP document collection: total documents, pages, breakdown by agency, decade, location, sensor types, and more. Useful for answering 'how many' questions and understanding the overall scope of the collection.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  },
);

/**
 * get_research_correlations — Get research correlations and context about the PURSUE release.
 */
export const getResearchCorrelations = tool(
  "get_research_correlations",
  "Get research correlations, background context, and analysis about the PURSUE UAP document release. Each correlation covers a topic (e.g. 'The PURSUE Release', sensor patterns, geographic clusters) with detailed context and source citations. Optionally filter by topic keyword.",
  {
    topic: z
      .string()
      .optional()
      .describe("Filter correlations by keyword in the topic or context fields"),
  },
  async (args) => {
    let correlations = research.correlations;

    if (args.topic) {
      const topicLower = args.topic.toLowerCase();
      correlations = correlations.filter((c) => {
        const searchable = [c.topic, c.context].join(" ").toLowerCase();
        return searchable.includes(topicLower);
      });
    }

    if (correlations.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No research correlations found${args.topic ? ` matching "${args.topic}"` : ""}.`,
          },
        ],
      };
    }

    const resultData = correlations.map((c) => ({
      topic: c.topic,
      context: c.context,
      sources: c.sources,
      related_docs: c.related_docs || [],
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_correlations: research.correlations.length,
              matching: resultData.length,
              correlations: resultData,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);
