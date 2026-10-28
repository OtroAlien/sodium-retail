// Tabla adaptable: en pantallas medianas y grandes es una tabla; en el celular cada fila pasa a ser
// una tarjeta con el mismo contenido (nada se oculta), así no hace falta deslizar de costado.
import type { ReactNode } from 'react'
import { cx } from './ui'

export interface Col<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /**
   * Lugar en la tarjeta del celular:
   * - title: texto principal (arriba a la izquierda)
   * - value: dato destacado (arriba a la derecha: importe, estado)
   * - meta: dato con su rótulo, en una grilla (por defecto)
   * - actions: botones, abajo de la tarjeta
   */
  mobile?: 'title' | 'value' | 'meta' | 'actions'
  /** clases de la celda en la tabla (ej.: min-w-[14rem], whitespace-nowrap) */
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLabel,
  caption,
  rowClassName,
  breakpoint = 'md',
}: {
  columns: Col<T>[]
  rows: T[]
  rowKey: (r: T) => string
  onRowClick?: (r: T) => void
  /** nombre accesible de cada fila cuando es clickeable */
  rowLabel?: (r: T) => string
  caption: string
  rowClassName?: (r: T) => string | undefined
  breakpoint?: 'sm' | 'md' | 'lg'
}) {
  const showTable = { sm: 'hidden sm:block', md: 'hidden md:block', lg: 'hidden lg:block' }[breakpoint]
  const showCards = { sm: 'sm:hidden', md: 'md:hidden', lg: 'lg:hidden' }[breakpoint]
  const key = (e: React.KeyboardEvent, r: T) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault()
      onRowClick(r)
    }
  }
  const title = columns.filter((c) => c.mobile === 'title')
  const value = columns.filter((c) => c.mobile === 'value')
  const actions = columns.filter((c) => c.mobile === 'actions')
  const meta = columns.filter((c) => !c.mobile || c.mobile === 'meta')

  return (
    <>
      <div className={cx('scroll-x', showTable)} tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-white/[0.03]">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-300', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => key(e, r) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? rowLabel?.(r) : undefined}
                className={cx('border-t border-white/10 transition-colors hover:bg-white/[0.04]', onRowClick && 'cursor-pointer', rowClassName?.(r))}
              >
                {columns.map((c) => (
                  <td key={c.key} onClick={c.mobile === 'actions' ? (e) => e.stopPropagation() : undefined} className={cx('px-4 py-3 align-top', c.align === 'right' && 'text-right', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cx('divide-y divide-white/10', showCards)} aria-label={caption}>
        {rows.map((r) => (
          <li
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onKeyDown={onRowClick ? (e) => key(e, r) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'button' : undefined}
            aria-label={onRowClick ? rowLabel?.(r) : undefined}
            className={cx('px-4 py-3.5', onRowClick && 'cursor-pointer active:bg-white/[0.06]', rowClassName?.(r))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="wrap-any min-w-0 flex-1 text-sm font-semibold text-white">
                {title.map((c) => (
                  <div key={c.key}>{c.cell(r)}</div>
                ))}
              </div>
              {value.length > 0 && (
                <div className="shrink-0 text-right text-sm font-semibold text-white">
                  {value.map((c) => (
                    <div key={c.key}>{c.cell(r)}</div>
                  ))}
                </div>
              )}
            </div>
            {meta.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                {meta.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-xs font-medium text-ink-400">{c.header}</dt>
                    <dd className="wrap-any text-sm text-ink-100">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {actions.map((c) => (
                  <div key={c.key} className="contents">
                    {c.cell(r)}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
