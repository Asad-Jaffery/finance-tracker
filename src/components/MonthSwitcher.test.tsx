/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MonthSwitcher } from './MonthSwitcher.tsx'

afterEach(() => {
  cleanup()
})

describe('MonthSwitcher', () => {
  it('lists months from GET /api/months and selects the provided value', () => {
    render(
      <MonthSwitcher
        months={['2026-07', '2026-08']}
        value="2026-08"
        onChange={() => {}}
      />,
    )
    const select = screen.getByRole('combobox', { name: 'Month' })
    expect(select).toHaveProperty('value', '2026-08')
    const options = screen.getAllByRole('option').map((el) => el.getAttribute('value'))
    expect(options).toEqual(['2026-07', '2026-08'])
    expect(screen.getAllByRole('option').map((el) => el.textContent)).toEqual([
      'Jul 2026',
      'Aug 2026',
    ])
  })

  it('notifies onChange with the selected month and does not invent extra months', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MonthSwitcher
        months={['2026-07', '2026-08']}
        value="2026-08"
        onChange={onChange}
      />,
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2026-07')
  })
})
