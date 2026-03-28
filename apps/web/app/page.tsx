import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <div className="panel">
        <p className="eyebrow">Rewrite Workspace</p>
        <h1>PV Manager</h1>
        <p className="copy">
          This app is the clean rewrite track. The legacy application remains in the repo root as a separate
          reference codebase until the rewrite reaches MVP.
        </p>
        <ul className="list">
          <li>Next.js app shell is isolated under <code>apps/web</code>.</li>
          <li>Drizzle configuration and schema live only in the rewrite app.</li>
          <li>Legacy and rewrite dependencies now have separate package boundaries.</li>
        </ul>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href="/live"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              background: '#0d6b57',
              color: '#fff',
              borderRadius: '10px',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '0.92rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Live screen prototype →
          </Link>
        </div>
      </div>
    </main>
  );
}
