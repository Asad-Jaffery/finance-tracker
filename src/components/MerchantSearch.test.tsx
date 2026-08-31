/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MerchantSearch } from './MerchantSearch.tsx'

afterEach(() => {
  cleanup()
})

describe('MerchantSearch', () => {
  it('is a text input the user can type into', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MerchantSearch value="" onChange={onChange} />)
    const input = screen.getByRole('searchbox', { name: 'Search merchants' })
    expect(input).toBeTruthy()
    await user.type(input, 'chip')
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['c', 'h', 'i', 'p'])
    rerender(<MerchantSearch value="chip" onChange={onChange} />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('chip')
  })
})
