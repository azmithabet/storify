import { useState, useCallback, useMemo } from 'react'

/**
 * Manage a set of selected IDs for list-level bulk actions.
 *
 * Typical usage:
 *   const sel = useSelection(rows.map((r) => r.id))
 *   // pass `sel.isSelected`, `sel.toggle`, `sel.selectAll`, `sel.clear` to <Table selectable=... />
 *   // pass `sel.count` and `sel.ids` to <BulkActionBar />
 *
 * `allIds` is the IDs currently visible (typically the current page). `selectAll`
 * adds all of them; `clear` removes everything. Selected IDs that scroll off the
 * page stay in the set — caller can clear on pagination if that's not desired.
 */
export function useSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of allIds) next.add(id)
      return next
    })
  }, [allIds])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const allVisibleSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selected.has(id)),
    [allIds, selected],
  )
  const someVisibleSelected = useMemo(
    () => allIds.some((id) => selected.has(id)),
    [allIds, selected],
  )

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allIds.every((id) => next.has(id))) {
        for (const id of allIds) next.delete(id)
      } else {
        for (const id of allIds) next.add(id)
      }
      return next
    })
  }, [allIds])

  return {
    ids: useMemo(() => Array.from(selected), [selected]),
    count: selected.size,
    isSelected,
    toggle,
    selectAll,
    toggleAllVisible,
    clear,
    allVisibleSelected,
    someVisibleSelected,
  }
}
