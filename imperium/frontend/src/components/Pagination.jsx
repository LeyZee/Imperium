import { ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 25;

export { ITEMS_PER_PAGE };

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '0.75rem', padding: '1rem 0', fontSize: '0.85rem',
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.4rem 0.75rem', borderRadius: 8,
          border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
          color: page <= 1 ? 'var(--text-muted)' : 'var(--navy)',
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          fontWeight: 500, fontSize: '0.8rem',
          transition: 'all 150ms ease',
        }}
      >
        <ChevronLeft size={14} /> Préc.
      </button>

      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
        Page <strong style={{ color: 'var(--navy)' }}>{page}</strong> sur {totalPages}
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.4rem 0.75rem', borderRadius: 8,
          border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
          color: page >= totalPages ? 'var(--text-muted)' : 'var(--navy)',
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          fontWeight: 500, fontSize: '0.8rem',
          transition: 'all 150ms ease',
        }}
      >
        Suiv. <ChevronRight size={14} />
      </button>
    </div>
  );
}
