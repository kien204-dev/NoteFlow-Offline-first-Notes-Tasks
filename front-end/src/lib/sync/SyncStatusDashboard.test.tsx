import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncStatusDashboardView } from './SyncStatusDashboard'

const defaultProps = {
  status: 'synced' as const,
  connection: 'connected' as const,
  lastSyncedAt: '2026-07-14T10:00:00.000Z',
  error: null,
  dirtyCount: 0,
  conflictCount: 0,
  isOnline: true,
}

describe('SyncStatusDashboardView', () => {
  it('shows online SSE connection and pending record count', () => {
    render(<SyncStatusDashboardView {...defaultProps} dirtyCount={3} />)

    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Live via SSE')).toBeInTheDocument()
    expect(screen.getByText('3 records')).toBeInTheDocument()
  })

  it('shows offline fallback state', () => {
    render(
      <SyncStatusDashboardView
        {...defaultProps}
        status="offline"
        connection="fallback"
        isOnline={false}
      />,
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('30s fallback')).toBeInTheDocument()
  })

  it('shows the active syncing state', () => {
    render(<SyncStatusDashboardView {...defaultProps} status="syncing" />)
    expect(screen.getByText('Syncing now')).toBeInTheDocument()
  })

  it('announces only the latest sync error as a status update', () => {
    render(
      <SyncStatusDashboardView
        {...defaultProps}
        status="error"
        connection="fallback"
        error="Temporary network failure"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Last sync error: Temporary network failure',
    )
  })
})
