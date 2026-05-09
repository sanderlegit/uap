import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { documents } from "../data/loader.js";

/**
 * search_timeline — Filter documents by year range and/or agency, sorted chronologically.
 */
export const searchTimeline = tool(
  "search_timeline",
  "Search documents by time period. Filter by start/end year and optionally by agency. Returns documents sorted chronologically. Useful for understanding what happened in a specific era or tracking UAP activity over time.",
  {
    startYear: z
      .number()
      .int()
      .min(1940)
      .max(2030)
      .optional()
      .describe("Start year for the time range (inclusive)"),
    endYear: z
      .number()
      .int()
      .min(1940)
      .max(2030)
      .optional()
      .describe("End year for the time range (inclusive)"),
    agency: z
      .string()
      .optional()
      .describe("Filter by agency name, e.g. 'FBI', 'NASA', 'Department of War'"),
  },
  async (args) => {
    let results = documents.filter((doc) => {
      // Must have a parsed date to be placed on timeline
      if (!doc.incident_date_parsed) return false;

      const year = new Date(doc.incident_date_parsed).getFullYear();
      if (isNaN(year)) return false;

      if (args.startYear && year < args.startYear) return false;
      if (args.endYear && year > args.endYear) return false;

      if (args.agency) {
        const agencyLower = args.agency.toLowerCase();
        if (!doc.agency.toLowerCase().includes(agencyLower)) return false;
      }

      return true;
    });

    // Sort chronologically
    results.sort((a, b) => {
      const dateA = new Date(a.incident_date_parsed!).getTime();
      const dateB = new Date(b.incident_date_parsed!).getTime();
      return dateA - dateB;
    });

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No documents found${args.startYear || args.endYear ? ` between ${args.startYear || "earliest"} and ${args.endYear || "latest"}` : ""}${args.agency ? ` from ${args.agency}` : ""}.`,
          },
        ],
      };
    }

    const resultData = results.map((doc) => ({
      id: doc.id,
      title: doc.title,
      agency: doc.agency,
      incident_date: doc.incident_date,
      incident_date_parsed: doc.incident_date_parsed,
      location: doc.incident_location,
      decade: doc.decade,
      description_excerpt: doc.description?.slice(0, 150) || "",
      has_redaction: Boolean(doc.has_redaction),
      sensors: doc.sensors.map((s) => s.sensor_type),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              time_range: {
                start: args.startYear || "earliest",
                end: args.endYear || "latest",
              },
              total_matches: resultData.length,
              documents: resultData,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);
