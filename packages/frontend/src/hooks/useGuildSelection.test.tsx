import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGuildSelection } from './useGuildSelection'
import { useGuildStore } from '@/stores/guildStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/stores/guildStore')
vi.mock('@/stores/authStore')

type GuildState = {
    guilds: Array<{ id: string; botAdded: boolean }>
    selectedGuild: { id: string; botAdded: boolean } | null
    fetchGuilds: () => Promise<void>
    selectGuild: (guild: { id: string; botAdded: boolean }) => void
    guildLoadError: { kind: string; message: string; status?: number } | null
}

type AuthState = {
    isAuthenticated: boolean
    isLoading: boolean
}

describe('useGuildSelection', () => {
    const fetchGuilds = vi.fn<() => Promise<void>>()
    const selectGuild = vi.fn<(guild: { id: string; botAdded: boolean }) => void>()

    let guildState: GuildState
    let authState: AuthState

    beforeEach(() => {
        vi.clearAllMocks()

        fetchGuilds.mockResolvedValue()

        guildState = {
            guilds: [],
            selectedGuild: null,
            fetchGuilds,
            selectGuild,
            guildLoadError: null,
        }
        authState = {
            isAuthenticated: true,
            isLoading: false,
        }

        vi.mocked(useGuildStore).mockImplementation(
            ((selector: (state: GuildState) => unknown) => selector(guildState)) as
                typeof useGuildStore,
        )
        vi.mocked(useAuthStore).mockImplementation(
            ((selector: (state: AuthState) => unknown) => selector(authState)) as
                typeof useAuthStore,
        )
    })

    test('fetches guilds once when auth is ready and no auth error is present', async () => {
        renderHook(() => useGuildSelection())

        await waitFor(() => {
            expect(fetchGuilds).toHaveBeenCalledTimes(1)
        })
    })

    test('retries initial fetch once after auth-ready state when first result has auth error', async () => {
        guildState.guildLoadError = {
            kind: 'auth',
            message: 'Session expired',
            status: 401,
        }

        renderHook(() => useGuildSelection())

        await waitFor(() => {
            expect(fetchGuilds).toHaveBeenCalledTimes(2)
        })
    })
})
