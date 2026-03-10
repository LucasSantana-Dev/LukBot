import { describe, expect, it } from '@jest/globals'
import { ProviderHealthService } from './providerHealth'

describe('ProviderHealthService', () => {
    it('marks provider unavailable after consecutive failures', () => {
        const service = new ProviderHealthService({
            cooldownMs: 5_000,
            failureThreshold: 2,
        })
        const now = 1_000

        service.recordFailure('youtube', now, 'first failure')
        expect(service.isAvailable('youtube', now + 1)).toBe(true)

        service.recordFailure('youtube', now + 2, 'second failure')
        expect(service.isAvailable('youtube', now + 3)).toBe(false)
        expect(service.isAvailable('youtube', now + 5_100)).toBe(true)
    })

    it('recovers score and consecutive failures after success', () => {
        const service = new ProviderHealthService({
            cooldownMs: 5_000,
            failureThreshold: 2,
        })
        const now = 2_000

        service.recordFailure('spotify', now, 'fail')
        service.recordFailure('spotify', now + 1, 'fail')
        expect(service.getStatus('spotify').consecutiveFailures).toBe(2)

        service.recordSuccess('spotify', now + 6_000)

        const status = service.getStatus('spotify')
        expect(status.consecutiveFailures).toBe(0)
        expect(status.score).toBeGreaterThan(0.5)
        expect(service.isAvailable('spotify', now + 6_001)).toBe(true)
    })

    it('returns providers ordered by health score and availability', () => {
        const service = new ProviderHealthService({
            cooldownMs: 10_000,
            failureThreshold: 2,
        })
        const now = 4_000

        service.recordFailure('spotify', now, 'timeout')
        service.recordFailure('spotify', now + 1, 'timeout')
        service.recordSuccess('youtube', now + 2)
        service.recordSuccess('soundcloud', now + 3)

        const ordered = service.getOrderedProviders(
            ['spotify', 'youtube', 'soundcloud'],
            now + 100,
        )

        expect(ordered[0]).toBe('youtube')
        expect(ordered).not.toContain('spotify')
    })
})
