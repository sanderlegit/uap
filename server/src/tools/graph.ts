import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { graph, documents } from "../data/loader.js";

/**
 * find_related — Find documents related to a given document via the connection graph.
 */
export const findRelated = tool(
  "find_related",
  "Find documents that are connected to a given document in the relationship graph. Returns related documents sorted by connection weight (strongest connections first). Connections represent content similarity, shared entities, or shared incidents.",
  {
    docId: z
      .number()
      .int()
      .min(0)
      .max(128)
      .describe("The document ID to find connections for"),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of related documents to return (default 10)"),
  },
  async (args) => {
    // Find all edges involving this document
    const relatedEdges = graph.edges.filter(
      (e) => e.source_id === args.docId || e.target_id === args.docId
    );

    if (relatedEdges.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No connections found for document #${args.docId}.`,
          },
        ],
      };
    }

    // Build results with connected doc info
    const results = relatedEdges
      .map((edge) => {
        const connectedId =
          edge.source_id === args.docId ? edge.target_id : edge.source_id;
        const doc = documents.find((d) => d.id === connectedId);
        return {
          id: connectedId,
          title: doc?.title || `Document #${connectedId}`,
          agency: doc?.agency || "Unknown",
          decade: doc?.decade || "Unknown",
          location: doc?.incident_location || "Unknown",
          weight: Math.round(edge.weight * 1000) / 1000,
          edge_type: edge.edge_type,
        };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, args.maxResults);

    const sourceDoc = documents.find((d) => d.id === args.docId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              source_document: {
                id: args.docId,
                title: sourceDoc?.title || `Document #${args.docId}`,
              },
              total_connections: relatedEdges.length,
              showing: results.length,
              connections: results,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);

/**
 * get_connections — Get connection statistics and the most connected documents in the graph.
 */
export const getConnections = tool(
  "get_connections",
  "Get an overview of the document connection graph. Returns the most-connected documents (hubs) and overall graph statistics. Useful for understanding which documents are central to the collection.",
  {
    topN: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of most-connected documents to return (default 10)"),
  },
  async (args) => {
    // Count connections per node
    const connectionCounts = new Map<number, number>();
    for (const edge of graph.edges) {
      connectionCounts.set(
        edge.source_id,
        (connectionCounts.get(edge.source_id) || 0) + 1
      );
      connectionCounts.set(
        edge.target_id,
        (connectionCounts.get(edge.target_id) || 0) + 1
      );
    }

    const topNodes = Array.from(connectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, args.topN)
      .map(([id, count]) => {
        const doc = documents.find((d) => d.id === id);
        return {
          id,
          title: doc?.title || `Document #${id}`,
          agency: doc?.agency || "Unknown",
          decade: doc?.decade || "Unknown",
          connection_count: count,
        };
      });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              graph_stats: {
                total_nodes: graph.nodes.length,
                total_edges: graph.edges.length,
                avg_connections:
                  Math.round(
                    (graph.edges.length * 2) / graph.nodes.length * 100
                  ) / 100,
              },
              most_connected_documents: topNodes,
            },
            null,
            2
          ),
        },
      ],
    };
  },
);
