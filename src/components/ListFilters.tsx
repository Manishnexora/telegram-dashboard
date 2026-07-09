interface ListFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (v: string) => void
  onDateToChange?: (v: string) => void
}

export function ListFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: ListFiltersProps) {
  const showDateRange = onDateFromChange && onDateToChange

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[180px] space-y-1">
        <label className="block text-xs font-medium text-gray-500">Search</label>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? 'Search…'}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {showDateRange && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange!(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange!(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  )
}
