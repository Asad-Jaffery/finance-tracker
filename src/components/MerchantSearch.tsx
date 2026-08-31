export function MerchantSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="merchant-search">
      Search
      <input
        type="search"
        aria-label="Search merchants"
        placeholder="Search merchants"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </label>
  )
}
