import React, {useMemo, useState} from 'react';
import { Button, TextField } from '@omnitron-dev/prism/ui';
import { ArrowLeftIcon, ArrowRightIcon } from '@omnitron-dev/prism/icons';
import data from '../data/api-index.json';
import styles from '../components/ApiExplorer/styles.module.css';

const pageSize = 40;
const sourceBase = `https://github.com/omnitron-dev/omni/blob/${data.revision}/`;

export default function ApiExplorer() {
  const [query, setQuery] = useState('');
  const [pkg, setPackage] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(0);
  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.symbols.filter(row =>
      (!pkg || row.package === pkg) && (!kind || row.kind === kind) &&
      words.every(word => `${row.name} ${row.imports.map(item => item.path).join(' ')}`.toLowerCase().includes(word)),
    );
  }, [query, pkg, kind]);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const visible = matches.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <section className={styles.explorer} aria-label="Public API explorer">
      <p className={styles.inventory}>
        {data.packages.length} packages · {data.entryPoints.length} entry points · {data.symbols.length.toLocaleString('en')} exports
      </p>
      <div className={styles.filters}>
        <TextField className={styles.search} type="search" label="Search API"
          size="small" placeholder="Symbol or import path…" value={query}
          onChange={event => { setQuery(event.target.value); setPage(0); }} />
        <TextField select label="Package" size="small" value={pkg} id="api-package"
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          onChange={event => { setPackage(event.target.value); setPage(0); }}>
          <option value="">All packages</option>
          {data.packages.map(name => <option key={name} value={name}>{name.replace('@omnitron-dev/', '')}</option>)}
        </TextField>
        <TextField select label="Kind" size="small" value={kind} id="api-export-kind"
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          onChange={event => { setKind(event.target.value); setPage(0); }}>
          <option value="">All exports</option>
          {['class', 'enum', 'function', 'interface', 'type', 'value'].map(value =>
            <option key={value} value={value}>{value}</option>)}
        </TextField>
      </div>
      <p className={styles.results} role="status" aria-live="polite">
        {matches.length.toLocaleString('en')} {matches.length === 1 ? 'result' : 'results'}
        {matches.length > 0 && ` · ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, matches.length)}`}
      </p>
      {visible.length ? (
        <ul className={styles.list}>
          {visible.map((row, index) => (
            <li key={`${row.package}:${row.name}:${index}`}>
              <div className={styles.symbol}>
                <code>{row.name}</code>
                <span>{row.kind}</span>
                {row.source && <a href={sourceBase + row.source} className={styles.source}>Source ↗</a>}
              </div>
              <div className={styles.imports}>
                {row.imports.map(item => (
                  <div key={item.path}>
                    <code>{item.path}</code>
                    <a href={item.guide}>Guide →</a>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : <p>No matching exports. Try a shorter symbol name or clear the package filter.</p>}
      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="API results pagination">
          <Button startIcon={<ArrowLeftIcon />} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {pageCount}</span>
          <Button endIcon={<ArrowRightIcon />} disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
      <details className={styles.entries}>
        <summary>Browse all package entry points</summary>
        <ul>
          {data.entryPoints.map(entry => (
            <li key={entry.path}><a href={entry.guide}><code>{entry.path}</code></a>
              {'kind' in entry && <> · {entry.kind} · <a href={sourceBase + entry.source}>Source ↗</a></>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
