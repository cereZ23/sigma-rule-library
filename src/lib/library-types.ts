/** Shape of one entry of the client-side library index (built by scripts/build-search-index.ts). */
export interface LibraryRecord {
  slug: string;
  title: string;
  description: string;
  level: string;
  status: string;
  ruleType: string;
  section: string;
  product: string | null;
  service: string | null;
  category: string | null;
  tactics: string[];
  techniques: string[];
  authors: string[];
  created: string | null;
  modified: string | null;
  yearCreated: number | null;
  yearModified: number | null;
  path: string;
  search: string;
}
