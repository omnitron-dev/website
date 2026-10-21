import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import data from '@site/src/data/api-index.json';
import styles from './styles.module.css';

const pageSize = 40;

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
        <label className={styles.search}>
          Search API
          <input type="search" placeholder="Symbol or import path…" value={query}
            onChange={event => { setQuery(event.target.value); setPage(0); }} />
        </label>
        <label>
          Package
          <select value={pkg} onChange={event => { setPackage(event.target.value); setPage(0); }}>
            <option value="">All packages</option>
            {data.packages.map(name => <option key={name} value={name}>{name.replace('@omnitron-dev/', '')}</option>)}
          </select>
        </label>
        <label>
          Kind
          <select value={kind} onChange={event => { setKind(event.target.value); setPage(0); }}>
            <option value="">All exports</option>
            {['class', 'enum', 'function', 'interface', 'type', 'value'].map(value =>
              <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
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
                {row.source && <a href={row.source} className={styles.source}>Source ↗</a>}
              </div>
              <div className={styles.imports}>
                {row.imports.map(item => (
                  <div key={item.path}>
                    <code>{item.path}</code>
                    <Link to={item.guide}>Guide →</Link>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : <p>No matching exports. Try a shorter symbol name or clear the package filter.</p>}
      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="API results pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
          <span>Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>Next →</button>
        </nav>
      )}
      <details className={styles.entries}>
        <summary>Browse all package entry points</summary>
        <ul>
          {data.entryPoints.map(entry => (
            <li key={entry.path}><Link to={entry.guide}><code>{entry.path}</code></Link>
              {'kind' in entry && <> · {entry.kind} · <a href={entry.source}>Source ↗</a></>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
