/** Shape of the generated import-errors.json report (built by scripts/parse-sigma.ts). */
export interface ImportErrorsReport {
  generatedAt: string;
  sourceCommit: string;
  totalFiles: number;
  importedRules: number;
  failedFiles: number;
  errors: { file: string; reason: string }[];
  duplicateIds: { id: string; files: string[] }[];
  duplicateSlugs: { slug: string; files: string[] }[];
}
