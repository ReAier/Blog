import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface BlogDateFieldProps {
  ariaLabel: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | undefined {
  if (!isoDatePattern.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year!, month! - 1, day);
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day
    ? date
    : undefined;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calendarDays(month: Date): Array<Date | undefined> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from<undefined>({ length: firstWeekday }),
    ...Array.from({ length: dayCount }, (_, index) => new Date(year, monthIndex, index + 1)),
  ];
}

export function BlogDateField({
  ariaLabel,
  value,
  required = false,
  disabled = false,
  onChange,
}: BlogDateFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, [open]);

  const selectDate = (date: Date) => {
    onChange(toIsoDate(date));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  };

  const changeMonth = (offset: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const days = calendarDays(viewMonth);
  const today = toIsoDate(new Date());

  return (
    <div className={`blog-date${open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={handleKeyDown}>
      <div className="blog-date__control">
        <input
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          inputMode="numeric"
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder="YYYY-MM-DD"
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={triggerRef}
          className="blog-date__trigger"
          type="button"
          aria-label={`打开${ariaLabel}日历`}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (!open && selectedDate) setViewMonth(selectedDate);
            setOpen((current) => !current);
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 2v3M15 2v3M3 7h14M4 4h12a1 1 0 0 1 1 1v12H3V5a1 1 0 0 1 1-1Z" />
            <path d="M6 10h2M10 10h2M14 10h1M6 13h2M10 13h2" />
          </svg>
        </button>
      </div>
      {open && (
        <section className="blog-calendar" role="dialog" aria-label={`${ariaLabel}日历`}>
          <header className="blog-calendar__header">
            <button type="button" aria-label="上个月" onClick={() => changeMonth(-1)}>←</button>
            <strong>{viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月</strong>
            <button type="button" aria-label="下个月" onClick={() => changeMonth(1)}>→</button>
          </header>
          <div className="blog-calendar__weekdays" aria-hidden="true">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="blog-calendar__grid">
            {days.map((date, index) => date ? (
              <button
                className={`${toIsoDate(date) === value ? 'is-selected' : ''}${toIsoDate(date) === today ? ' is-today' : ''}`}
                key={toIsoDate(date)}
                type="button"
                aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`}
                aria-pressed={toIsoDate(date) === value}
                onClick={() => selectDate(date)}
              >
                {date.getDate()}
              </button>
            ) : <span key={`blank-${index}`} />)}
          </div>
          <footer className="blog-calendar__footer">
            {!required && <button type="button" onClick={() => { onChange(''); setOpen(false); }}>清除</button>}
            <button type="button" onClick={() => selectDate(new Date())}>今天</button>
          </footer>
        </section>
      )}
    </div>
  );
}
