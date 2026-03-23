import { useState, useEffect, useCallback } from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh?: () => void;
}

const PAGE_SIZES = [10, 25, 50, 100, 200, 500];

export function Pagination({
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: PaginationProps) {
  const [pageInput, setPageInput] = useState(String(page));

  // Keep input in sync when page changes externally
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(pageInput, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        onPageChange(num);
      } else {
        // Reset to current page if invalid
        setPageInput(String(page));
      }
    }
  };

  const handlePageInputBlur = () => {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    } else {
      setPageInput(String(page));
    }
  };

  // Keyboard shortcuts: Alt+Left = previous, Alt+Right = next
  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft' && page > 1) {
        e.preventDefault();
        onPageChange(page - 1);
      } else if (e.altKey && e.key === 'ArrowRight' && page < totalPages) {
        e.preventDefault();
        onPageChange(page + 1);
      }
    },
    [page, totalPages, onPageChange],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  return (
    <div className="pagination">
      {onRefresh && (
        <button
          className="pagination__btn"
          onClick={onRefresh}
          title="Refresh"
        >
          &#x21bb;
        </button>
      )}

      <span className="pagination__separator" />

      <div className="pagination__controls">
        <button
          className="pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          title="First page"
        >
          &#x23EE;
        </button>
        <button
          className="pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Previous page (Alt+Left)"
        >
          &#x25C0;
        </button>

        <input
          className="pagination__page-input"
          type="text"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={handlePageInputKeyDown}
          onBlur={handlePageInputBlur}
          title="Page number — press Enter to jump"
        />
        <span className="pagination__of">/ {totalPages}</span>

        <button
          className="pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Next page (Alt+Right)"
        >
          &#x25B6;
        </button>
        <button
          className="pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
        >
          &#x23ED;
        </button>
      </div>

      <span className="pagination__separator" />

      <div className="pagination__page-size">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          title="Documents per page"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <span className="pagination__separator" />

      <div className="pagination__info">
        {total === 0 ? (
          <span>No documents</span>
        ) : (
          <>
            Documents <strong>{start}</strong> to <strong>{end}</strong>
          </>
        )}
      </div>

      <span className="pagination__total">
        {total > 0 && <>({total.toLocaleString()} total)</>}
      </span>
    </div>
  );
}
