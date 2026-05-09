import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { entities } from "../data/loader.js";

/**
 * search_entities — Search for entities (organizations, people, locations) mentioned across documents.
 */
export const searchEntities = tool(
  "search_entities",
  "Search for entities (organizations, people, locations, etc.) mentioned across the UAP document collection. Returns matching entities with the documents they appear in, which agencies reference them, and which decades they span.",
  {
    name: z
      .string()
      .describe("Name or partial name of the entity to search for (case-insensitive substring match)"),
    type: z
      .string()
      .optional()
      .describe("Filter by entity type, e.g. 'organization', 'person', 'location'"),
  },
  async (args) => {
    if (entities.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Entity data is not available.",
          },
        ],
        isError: true,
      };
    }

    const nameLower = args.name.toLowerCase();
    let results = entities.filter((e) =>
      e.name.toLowerCase().includes(nameLower)
    );

    if (args.type) {
      const typeLower = args.type.toLowerCase();
      results = results.filter((e) => e.type.toLowerCase() === typeLower);
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No entities found matching "${args.name}"${args.type ? ` of type "${args.type}"` : ""}.`,
          },
        ],
      };
    }

    const resultData = results.map((e) => ({
      name: e.name,
      type: e.type,
      doc_count: e.doc_count,
      doc_ids: e.doc_ids,
      agencies: e.agencies,
      decades: e.decades,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_entities: entities.length,
              matching: resultData.length,
              entities: resultData,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);
