import { formatMonth } from '../totals.ts'

export function MonthSwitcher({
  months,
  value,
  onChange,
}: {
  months: string[]
  value: string
  onChange: (month: string) => void
}) {
  return (
    <label className="month-switcher">
      Month
      <select
        aria-label="Month"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>
    </label>
  )
}
