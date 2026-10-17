function escapeCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]!);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(",")),
  ].join("\n");
  download("\uFEFF" + csv, `${filename}.csv`, "text/csv;charset=utf-8;");
  return true;
}

/** Excel-readable export (SpreadsheetML table opened natively by Excel). */
export function exportExcel<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html><head><meta charset="utf-8" /></head><body><table border="1">
<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`).join("")}</tbody>
</table></body></html>`;
  download(html, `${filename}.xls`, "application/vnd.ms-excel");
  return true;
}
