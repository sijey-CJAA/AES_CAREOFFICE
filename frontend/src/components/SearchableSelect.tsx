import { useEffect, useMemo, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SingleSearchableSelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  required = false,
}: SingleSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === value)?.label ?? '',
    [options, value]
  );

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        id={id}
        type="text"
        className="form-control"
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        required={required && !value}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        autoComplete="off"
      />
      {open && (
        <div className="searchable-select-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matches found.
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`searchable-select-option ${opt.value === value ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface MultiSearchableSelectProps {
  id?: string;
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSearchableSelect({
  id,
  options,
  values,
  onChange,
  placeholder = '-- Search and add students --',
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => !selectedSet.has(o.value) && (!q || o.label.toLowerCase().includes(q))
    );
  }, [options, query, selectedSet]);

  return (
    <div className="searchable-select" ref={containerRef}>
      {values.length > 0 && (
        <div className="selected-chips">
          {values.map((val) => {
            const label = options.find((o) => o.value === val)?.label ?? val;
            return (
              <span key={val} className="selected-chip">
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => onChange(values.filter((v) => v !== val))}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <input
        id={id}
        type="text"
        className="form-control"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        autoComplete="off"
      />
      {open && (
        <div className="searchable-select-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No remaining matches.
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={false}
                className="searchable-select-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange([...values, opt.value]);
                  setQuery('');
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

