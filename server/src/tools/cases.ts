import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { casesData } from "../data/loader.js";

/**
 * search_cases — Search the curated high-interest UAP cases.
 */
export const searchCases = tool(
  "search_cases",
  "Search the curated collection of high-interest UAP cases (e.g. USS Nimitz/Tic Tac, Roswell, Phoenix Lights). Each case includes detailed narratives, evidence types, key figures, and source links. Filter by category (e.g. 'military_encounter') or search by keyword.",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter by case category, e.g. 'military_encounter', 'civilian_sighting', 'government_program'"
      ),
    query: z
      .string()
      .optional()
      .describe("Search keyword to match against case name, summary, detail, location, and key figures"),
  },
  async (args) => {
    let results = casesData.cases;

    if (args.category) {
      const catLower = args.category.toLowerCase();
      results = results.filter((c) => c.category.toLowerCase() === catLower);
    }

    if (args.query) {
      const queryLower = args.query.toLowerCase();
      results = results.filter((c) => {
        const searchable = [
          c.name,
          c.summary,
          c.detail,
          c.location,
          ...c.key_figures,
          ...c.evidence_types,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(queryLower);
      });
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No cases found${args.category ? ` in category "${args.category}"` : ""}${args.query ? ` matching "${args.query}"` : ""}.`,
          },
        ],
      };
    }

    const resultData = results.map((c) => ({
      id: c.id,
      name: c.name,
      year: c.year,
      date: c.date,
      location: c.location,
      category: c.category,
      summary: c.summary,
      evidence_types: c.evidence_types,
      key_figures: c.key_figures,
      validity: c.validity,
      sources_count: c.sources.length,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_cases: casesData.cases.length,
              matching: resultData.length,
              cases: resultData,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);
