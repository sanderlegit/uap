import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  documents,
  searchFullText,
  getIndividualDoc,
  narratives,
} from "../data/loader.js";

/**
 * search_documents — Search documents by keyword, optionally filtered by agency/decade.
 */
export const searchDocuments = tool(
  "search_documents",
  "Search the UAP document collection by keyword. Matches against title, summary, location, and full text. Optionally filter by agency (e.g. 'Department of War', 'FBI', 'NASA', 'Department of State') or decade (e.g. '2020s', '1960s'). Returns matching documents with id, title, agency, date, location, and a text excerpt.",
  {
    query: z.string().describe("Search query keywords"),
    agency: z
      .string()
      .optional()
      .describe("Filter by agency name, e.g. 'FBI', 'NASA', 'Department of War', 'Department of State'"),
    decade: z
      .string()
      .optional()
      .describe("Filter by decade, e.g. '2020s', '1960s', '1950s'"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of results to return (default 10)"),
  },
  async (args) => {
    const results = searchFullText(args.query, 50);

    let filtered = results.map((r) => {
      const doc = documents.find((d) => d.id === r.docId);
      return { ...r, doc };
    }).filter((r) => r.doc != null);

    if (args.agency) {
      const agencyLower = args.agency.toLowerCase();
      filtered = filtered.filter(
        (r) => r.doc!.agency.toLowerCase().includes(agencyLower)
      );
    }

    if (args.decade) {
      filtered = filtered.filter((r) => r.doc!.decade === args.decade);
    }

    const limited = filtered.slice(0, args.limit);

    if (limited.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No documents found matching "${args.query}"${args.agency ? ` from ${args.agency}` : ""}${args.decade ? ` in ${args.decade}` : ""}.`,
          },
        ],
      };
    }

    const resultData = limited.map((r) => ({
      id: r.doc!.id,
      title: r.doc!.title,
      agency: r.doc!.agency,
      date: r.doc!.incident_date || r.doc!.release_date,
      location: r.doc!.incident_location,
      decade: r.doc!.decade,
      excerpt:
        r.doc!.description?.slice(0, 200) ||
        r.doc!.summary?.slice(0, 200) ||
        "",
      relevance_score: r.score,
      matched_fields: r.matchedFields,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_matches: filtered.length,
              showing: limited.length,
              results: resultData,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * get_document — Get full details for a specific document by ID.
 */
export const getDocument = tool(
  "get_document",
  "Get detailed information about a specific UAP document by its numeric ID (0-128). Returns document metadata, narrative context (why it matters, key findings), entities mentioned, redaction info, and cross-references. Does NOT return full text (too large) — use search_documents to find relevant excerpts.",
  {
    id: z.number().int().min(0).max(128).describe("Document ID (0-128)"),
  },
  async (args) => {
    const doc = getIndividualDoc(args.id);
    if (!doc) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Document #${args.id} not found.`,
          },
        ],
        isError: true,
      };
    }

    const narrative = narratives[String(args.id)] || null;

    const result = {
      id: doc.id,
      title: doc.title,
      agency: doc.agency,
      release_date: doc.release_date,
      incident_date: doc.incident_date,
      incident_date_parsed: doc.incident_date_parsed,
      incident_location: doc.incident_location,
      latitude: doc.latitude,
      longitude: doc.longitude,
      description: doc.description,
      file_type: doc.file_type,
      has_redaction: doc.has_redaction,
      total_pages: doc.total_pages,
      text_length: doc.text_length,
      decade: doc.decade,
      sensors: doc.sensors,
      behaviors: doc.behaviors,
      witnesses: doc.witnesses,
      entities: doc.entities,
      redaction: doc.redaction || null,
      cross_refs: doc.cross_refs || [],
      narrative: narrative
        ? {
            hook: narrative.hook,
            why_it_matters: narrative.why_it_matters,
            key_findings: narrative.key_findings,
          }
        : null,
      excerpt: doc.excerpt || doc.summary?.slice(0, 500) || "",
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);
