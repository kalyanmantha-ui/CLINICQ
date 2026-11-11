import { useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode }

/** A typed table with an optional pager. The caption names the table for screen readers. */
export function DataTable<T>({ rows, columns, rowKey, caption, pageSize }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; caption: string; pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const shown = pageSize ? rows.slice(current * pageSize, (current + 1) * pageSize) : rows;
  return (
    <div className="card tablecard">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.header}</th>)}</tr></thead>
        <tbody>{shown.map((r) => <tr key={rowKey(r)}>{columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
      {pageSize && pages > 1 && (
        <nav className="pager" aria-label={`${caption} pages`}>
          <Button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <span aria-live="polite">Page {current + 1} of {pages}</span>
          <Button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </nav>
      )}
    </div>
  );
}
