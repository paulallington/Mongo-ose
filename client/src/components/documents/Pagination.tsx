interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination__info">
        Showing <strong>{start}</strong>-<strong>{end}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong>
      </div>

      <div className="pagination__spacer" />

      <div className="pagination__page-size">
        <span>Per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="pagination__controls">
        <button
          className="btn btn--secondary btn--sm"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          title="First page"
        >
          &laquo;
        </button>
        <button
          className="btn btn--secondary btn--sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Previous page"
        >
          &lsaquo;
        </button>
        <span className="text-secondary" style={{ fontSize: 12, padding: '0 4px' }}>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn--secondary btn--sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Next page"
        >
          &rsaquo;
        </button>
        <button
          className="btn btn--secondary btn--sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}
