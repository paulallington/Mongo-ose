import { useState, useEffect } from 'react';

interface PromptDialogProps {
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({ title, label, placeholder, defaultValue, onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue || '');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [value, onConfirm, onCancel]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="modal__close" onClick={onCancel}>&times;</button>
        </div>
        <div className="modal__body">
          <div className="form-group">
            <label className="form-label">{label}</label>
            <input
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={() => onConfirm(value.trim())} disabled={!value.trim()}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
