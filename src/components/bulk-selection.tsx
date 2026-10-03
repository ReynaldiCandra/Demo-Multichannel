'use client';

/**
 * Utilitas aksi massal (bulk) yang dipakai lintas halaman: hook seleksi baris
 * + bar aksi mengambang. Polanya:
 *
 *   const bulk = useBulkSelection<string>();
 *   bulk.toggle(row.id)               // checkbox per baris
 *   bulk.toggleAll(visibleIds)        // checkbox di header tabel
 *   <BulkBar ... />                   // muncul saat ada yang dipilih
 */

import { useCallback, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';

export function useBulkSelection<T extends string = string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: T[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set<T>() : new Set(ids);
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  /** Hapus dari seleksi semua ID yang sudah tidak ada di daftar terlihat. */
  const prune = useCallback((visibleIds: T[]) => {
    setSelected((prev) => {
      const visible = new Set(visibleIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  return useMemo(
    () => ({
      selected,
      count: selected.size,
      isSelected,
      toggle,
      toggleAll,
      clear,
      prune,
      /** Semua ID di `ids` sudah terpilih? (untuk state checkbox header) */
      allSelected: (ids: T[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    }),
    [selected, isSelected, toggle, toggleAll, clear, prune],
  );
}

export type BulkSelection = ReturnType<typeof useBulkSelection>;

export type BulkAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * Bar aksi mengambang di bawah layar: muncul hanya saat ada baris terpilih.
 * Aksi "Hapus" ditaruh otomatis di depan kalau `onDelete` diberikan.
 */
export function BulkBar({
  count,
  label = 'item',
  actions,
  onDelete,
  deleteLabel = 'Hapus terpilih',
  onClear,
}: {
  count: number;
  label?: string;
  actions?: BulkAction[];
  onDelete?: () => void;
  deleteLabel?: string;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Aksi massal" data-testid="bulk-bar">
      <span className="bulk-bar-count">
        <b>{count}</b> {label} dipilih
      </span>
      <div className="bulk-bar-actions">
        {onDelete && (
          <Button variant="danger" onClick={onDelete} data-testid="button-bulk-delete">
            <Trash2 size={14} /> {deleteLabel}
          </Button>
        )}
        {actions?.map((action) => (
          <Button
            key={action.label}
            variant={action.danger ? 'danger' : 'secondary'}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
        <button type="button" className="icon-btn" onClick={onClear} aria-label="Bersihkan seleksi">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/** Checkbox baris/header bergaya ringkas untuk tabel & kanban. */
export function BulkCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      className="bulk-check"
      checked={checked}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
    />
  );
}
