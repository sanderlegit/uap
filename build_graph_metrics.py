#!/usr/bin/env python3
"""Add centrality scores and community labels to graph.json."""

import json
from pathlib import Path

import networkx as nx
from networkx.algorithms.community import greedy_modularity_communities

GRAPH_PATH = Path(__file__).parent / "website" / "public" / "data" / "graph.json"


def main():
    # Load graph data
    with open(GRAPH_PATH) as f:
        data = json.load(f)

    # Build NetworkX graph
    G = nx.Graph()
    for node in data["nodes"]:
        G.add_node(node["id"])
    for edge in data["edges"]:
        G.add_edge(edge["source_id"], edge["target_id"], weight=edge["weight"])

    # Compute betweenness centrality (weighted)
    centrality = nx.betweenness_centrality(G, weight="weight")

    # Compute communities using greedy modularity
    communities = greedy_modularity_communities(G, weight="weight")

    # Build node-id -> community-label mapping
    community_map = {}
    for label, community in enumerate(communities):
        for node_id in community:
            community_map[node_id] = label

    # Enrich nodes
    for node in data["nodes"]:
        nid = node["id"]
        node["centrality"] = round(centrality.get(nid, 0.0), 6)
        node["community"] = community_map.get(nid, -1)

    # Write back
    with open(GRAPH_PATH, "w") as f:
        json.dump(data, f)

    # Summary
    num_communities = len(communities)
    print(f"Communities found: {num_communities}")
    print()

    top5 = sorted(data["nodes"], key=lambda n: n["centrality"], reverse=True)[:5]
    print("Top 5 highest-centrality nodes:")
    for n in top5:
        print(f"  id={n['id']:3d}  centrality={n['centrality']:.6f}  community={n['community']}  {n['label'][:70]}")


if __name__ == "__main__":
    main()
