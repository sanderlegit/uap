import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the website's public/data directory
const DATA_DIR = resolve(__dirname, "../../../website/public/data");

function loadJSON<T>(filename: string): T {
  const filepath = resolve(DATA_DIR, filename);
  const raw = readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

function loadJSONOptional<T>(filename: string, fallback: T): T {
  const filepath = resolve(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    return fallback;
  }
  const raw = readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

// --- Type definitions ---

export interface DocumentSensor {
  sensor_type: string;
  mention_count: number;
}

export interface DocumentEntity {
  entity_type: string;
  entity_value: string;
}

export interface Document {
  id: number;
  filename: string;
  title: string;
  agency: string;
  release_date: string;
  incident_date: string;
  incident_date_parsed: string | null;
  incident_location: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  file_type: string;
  has_redaction: number;
  total_pages: number;
  text_length: number;
  extraction_method: string;
  decade: string;
  summary: string;
  ocr_applied: number;
  sensors: DocumentSensor[];
  behaviors: string[];
  witnesses: string[];
  entities: DocumentEntity[];
  shapes?: string[];
}

export interface IndividualDoc {
  id: number;
  filename: string;
  title: string;
  agency: string;
  release_date: string;
  incident_date: string;
  incident_date_parsed: string | null;
  incident_location: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  file_type: string;
  has_redaction: number;
  total_pages: number;
  text_length: number;
  extraction_method: string;
  decade: string;
  summary: string;
  ocr_applied: number;
  sensors: DocumentSensor[];
  behaviors: string[];
  witnesses: string[];
  entities: DocumentEntity[];
  shapes?: string[];
  redaction?: Record<string, unknown>;
  cross_refs?: Array<{ target_id: number; score: number; shared_entities?: string[] }>;
  excerpt?: string;
  full_text?: string;
}

export interface GraphNode {
  id: number;
  label: string;
  agency: string;
  lat: number | null;
  lng: number | null;
  decade: string;
  connections: number;
}

export interface GraphEdge {
  source_id: number;
  target_id: number;
  weight: number;
  edge_type: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CaseSource {
  title: string;
  url: string;
}

export interface Case {
  id: string;
  name: string;
  year: number;
  date: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  category: string;
  summary: string;
  detail: string;
  validity: string;
  evidence_types: string[];
  key_figures: string[];
  sources: CaseSource[];
  thumbnail?: string;
}

export interface CasesData {
  last_updated: string;
  overview: string;
  categories: Record<string, unknown>;
  cases: Case[];
}

export interface Correlation {
  topic: string;
  context: string;
  sources: CaseSource[];
  related_docs?: number[];
  [key: string]: unknown;
}

export interface ResearchData {
  last_updated: string;
  correlations: Correlation[];
}

export interface Narrative {
  hook: string;
  why_it_matters: string;
  key_findings: string[];
}

export interface SearchIndexEntry {
  id: number;
  title: string;
  agency: string;
  text: string;
  location: string;
  date: string;
  decade: string;
}

export interface EntityEntry {
  name: string;
  type: string;
  doc_ids: number[];
  doc_count: number;
  agencies: string[];
  decades: string[];
}

export interface Stats {
  total_files: number;
  total_pages: number;
  total_text_chars: number;
  files_with_text: number;
  files_ocr_applied: number;
  duplicates_removed: number;
  by_agency: Record<string, number>;
  by_decade: Record<string, number>;
  by_location: Record<string, number>;
  [key: string]: unknown;
}

// --- Load all data at startup ---

console.log(`[data] Loading data from ${DATA_DIR}`);

export const documents: Document[] = loadJSON<Document[]>("documents.json");
export const graph: Graph = loadJSON<Graph>("graph.json");
export const casesData: CasesData = loadJSON<CasesData>("cases.json");
export const research: ResearchData = loadJSON<ResearchData>("research.json");
export const narratives: Record<string, Narrative> = loadJSON<Record<string, Narrative>>("doc_narratives.json");
export const searchIndex: SearchIndexEntry[] = loadJSON<SearchIndexEntry[]>("search_index.json");
export const stats: Stats = loadJSON<Stats>("stats.json");
export const entities: EntityEntry[] = loadJSONOptional<EntityEntry[]>("entities.json", []);

// Cache individual docs in memory keyed by id
const docCache = new Map<number, IndividualDoc>();

export function getIndividualDoc(id: number): IndividualDoc | null {
  if (docCache.has(id)) {
    return docCache.get(id)!;
  }
  const filename = `doc_${id}.json`;
  const filepath = resolve(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    return null;
  }
  const doc = loadJSON<IndividualDoc>(filename);
  docCache.set(id, doc);
  return doc;
}

// --- Simple in-memory full-text search ---

interface InvertedIndexEntry {
  docId: number;
  field: string;
}

const invertedIndex = new Map<string, InvertedIndexEntry[]>();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function addToIndex(docId: number, text: string, field: string): void {
  const tokens = tokenize(text);
  for (const token of tokens) {
    if (!invertedIndex.has(token)) {
      invertedIndex.set(token, []);
    }
    invertedIndex.get(token)!.push({ docId, field });
  }
}

// Build index from search_index.json entries
for (const entry of searchIndex) {
  addToIndex(entry.id, entry.title, "title");
  addToIndex(entry.id, entry.text, "text");
  if (entry.location) {
    addToIndex(entry.id, entry.location, "location");
  }
  if (entry.agency) {
    addToIndex(entry.id, entry.agency, "agency");
  }
}

// Also index document summaries and descriptions
for (const doc of documents) {
  if (doc.description) {
    addToIndex(doc.id, doc.description, "description");
  }
}

export function searchFullText(
  query: string,
  limit: number = 10
): Array<{ docId: number; score: number; matchedFields: string[] }> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Score each document by how many query tokens match, with field weighting
  const scores = new Map<number, { score: number; fields: Set<string> }>();
  const fieldWeights: Record<string, number> = {
    title: 5,
    location: 3,
    agency: 3,
    description: 2,
    text: 1,
  };

  for (const token of queryTokens) {
    const entries = invertedIndex.get(token);
    if (!entries) continue;

    // Deduplicate: count each doc only once per token per field
    const seen = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.docId}:${entry.field}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (!scores.has(entry.docId)) {
        scores.set(entry.docId, { score: 0, fields: new Set() });
      }
      const docScore = scores.get(entry.docId)!;
      docScore.score += fieldWeights[entry.field] || 1;
      docScore.fields.add(entry.field);
    }
  }

  // Sort by score descending and return top N
  return Array.from(scores.entries())
    .map(([docId, { score, fields }]) => ({
      docId,
      score,
      matchedFields: Array.from(fields),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

console.log(
  `[data] Loaded: ${documents.length} documents, ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${casesData.cases.length} cases, ${entities.length} entities`
);
console.log(`[data] Full-text index: ${invertedIndex.size} unique tokens`);
