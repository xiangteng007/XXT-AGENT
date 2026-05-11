/**
 * Data Export Utilities
 * Client-side CSV and JSON export for dashboard data
 */

/**
 * Convert array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns?: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) return '';

  const cols = columns || Object.keys(data[0]).map(key => ({ key: key as keyof T, label: String(key) }));
  const header = cols.map(c => `"${String(c.label)}"`).join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Download string content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data as CSV file
 */
export function exportCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  const csv = toCSV(data, columns);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `${filename}_${timestamp}.csv`);
}

/**
 * Export data as JSON file
 */
export function exportJSON<T>(data: T, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(json, `${filename}_${timestamp}.json`, 'application/json;charset=utf-8;');
}
