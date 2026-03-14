import { QueryType, type GuildQueue } from 'discord-player'
import type { User } from 'discord.js'
import { errorLog, debugLog } from '@lucky/shared/utils'
import {
    analyzeYouTubeError,
    logYouTubeError,
} from '../../utils/music/youtubeErrorHandler'
import { youtubeConfig } from '@lucky/shared/config'
import {
    providerFromTrack,
    providerHealthService,
} from '../../utils/music/search/providerHealth'

type PlayerEvents = {
    events: {
        on: (event: string, handler: Function) => void
    }
    on?: (event: string, handler: Function) => void
}

interface IQueueMetadata {
    requestedBy?: User | null
}

function toErrorDetails(error: unknown): {
    errorMessage: string
    errorStack?: string
    errorName?: string
} {
    if (error instanceof Error) {
        return {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
        }
    }

    return {
        errorMessage: String(error),
        errorName: typeof error,
    }
}

function toErrorInstance(error: unknown): Error | undefined {
    return error instanceof Error ? error : undefined
}

export const setupErrorHandlers = (player: PlayerEvents): void => {
    player.events.on('error', (queue: GuildQueue, error: Error) => {
        try {
            const details = toErrorDetails(error)
            errorLog({
                message: `Error in queue ${queue?.guild?.name || 'unknown'}:`,
                error: toErrorInstance(error),
                data: {
                    guildId: queue?.guild?.id ?? 'unknown',
                    guildName: queue?.guild?.name ?? 'unknown',
                    ...details,
                },
            })

            const isConnectionError =
                details.errorMessage.includes('ECONNRESET') ||
                details.errorMessage.includes('ECONNREFUSED') ||
                details.errorMessage.includes('ETIMEDOUT') ||
                details.errorMessage.includes('Connection reset by peer')

            if (isConnectionError && queue?.connection) {
                debugLog({
                    message:
                        'Detected connection error, attempting recovery...',
                })
                try {
                    if (queue.connection.state.status !== 'ready') {
                        queue.connection.rejoin()
                        debugLog({
                            message:
                                'Attempting to recover from connection error',
                        })
                    }
                } catch (recoveryError) {
                    errorLog({
                        message: 'Failed to recover from connection error:',
                        error: toErrorInstance(recoveryError),
                        data: toErrorDetails(recoveryError),
                    })
                }
            }
        } catch (handlerError) {
            errorLog({
                message: 'Queue error handler failed:',
                error: toErrorInstance(handlerError),
                data: toErrorDetails(handlerError),
            })
        }
    })

    player.events.on('playerError', (queue: GuildQueue, error: Error) => {
        void (async () => {
            try {
                await handlePlayerError(queue, error)
            } catch (handlerError) {
                errorLog({
                    message: 'Player error event handler failed:',
                    error: toErrorInstance(handlerError),
                    data: toErrorDetails(handlerError),
                })
            }
        })()
    })

    player.events.on('debug', (queue: GuildQueue, message: string) => {
        try {
            debugLog({
                message: `Player debug from ${queue?.guild?.name ?? 'unknown'}: ${message}`,
            })
        } catch (handlerError) {
            errorLog({
                message: 'Player queue debug handler failed:',
                error: toErrorInstance(handlerError),
                data: toErrorDetails(handlerError),
            })
        }
    })

    if (typeof player.on === 'function') {
        player.on('error', (error: Error) => {
            try {
                errorLog({
                    message: 'Unhandled player error:',
                    error: toErrorInstance(error),
                    data: toErrorDetails(error),
                })
            } catch (handlerError) {
                errorLog({
                    message: 'Player top-level error handler failed:',
                    error: toErrorInstance(handlerError),
                    data: toErrorDetails(handlerError),
                })
            }
        })

        player.on('debug', (message: string) => {
            try {
                debugLog({
                    message: `Player runtime debug: ${message}`,
                })
            } catch (handlerError) {
                errorLog({
                    message: 'Player top-level debug handler failed:',
                    error: toErrorInstance(handlerError),
                    data: toErrorDetails(handlerError),
                })
            }
        })
    }
}

function handleYouTubeParserError(
    queue: GuildQueue,
    error: Error,
    youtubeErrorInfo: ReturnType<typeof analyzeYouTubeError>,
): void {
    const requestedBy: User | undefined =
        queue.currentTrack?.requestedBy ??
        (queue.metadata as IQueueMetadata).requestedBy ??
        undefined
    logYouTubeError(
        error,
        `player error in ${queue.guild.name}`,
        requestedBy?.id ?? 'unknown',
    )

    debugLog({
        message: 'YouTube parser error detected, skipping current track',
        data: {
            errorType: youtubeErrorInfo.isCompositeVideoError
                ? 'CompositeVideoPrimaryInfo'
                : youtubeErrorInfo.isHypePointsError
                  ? 'HypePointsFactoid'
                  : youtubeErrorInfo.isTypeMismatchError
                    ? 'TypeMismatch'
                    : 'Parser',
        },
    })

    if (youtubeConfig.errorHandling.skipOnParserError) {
        queue.node.skip()
    }
}

async function recoverFromStreamExtractionError(
    queue: GuildQueue,
    currentTrack: NonNullable<GuildQueue['currentTrack']>,
): Promise<void> {
    debugLog({
        message: `Problematic URL: ${currentTrack.url}`,
    })

    const requestedByUser: User | undefined =
        currentTrack.requestedBy ??
        (queue.metadata as IQueueMetadata).requestedBy ??
        undefined
    if (!requestedByUser) {
        queue.node.skip()
        return
    }

    const searchResult = await queue.player.search(currentTrack.title, {
        requestedBy: requestedByUser,
        searchEngine: QueryType.YOUTUBE_SEARCH,
    })

    if (!searchResult || searchResult.tracks.length === 0) {
        queue.node.skip()
        return
    }

    const alternativeTrack = searchResult.tracks.find(
        (track) => track.url !== currentTrack.url,
    )

    if (alternativeTrack) {
        queue.removeTrack(0)
        queue.addTrack(alternativeTrack)
        if (!queue.node.isPlaying()) {
            await queue.node.play()
            providerHealthService.recordSuccess(providerFromTrack(currentTrack))
            debugLog({
                message: 'Successfully recovered from stream extraction error',
            })
        }
    } else {
        queue.node.skip()
    }
}

const handlePlayerError = async (
    queue: GuildQueue,
    error: Error,
): Promise<void> => {
    try {
        const currentTrackProvider = providerFromTrack(
            queue.currentTrack ?? undefined,
        )
        providerHealthService.recordFailure(
            currentTrackProvider,
            Date.now(),
            error.message,
        )

        const youtubeErrorInfo = analyzeYouTubeError(error)

        if (youtubeErrorInfo.isParserError) {
            handleYouTubeParserError(queue, error, youtubeErrorInfo)
            return
        }

        errorLog({
            message: `Player error in queue ${queue.guild.name}:`,
            error: toErrorInstance(error),
            data: {
                guildId: queue.guild.id,
                guildName: queue.guild.name,
                ...toErrorDetails(error),
            },
        })

        const isStreamExtractionError =
            error.message.includes('Could not extract stream') ||
            error.message.includes('Streaming data not available') ||
            error.message.includes('chooseFormat')

        if (isStreamExtractionError) {
            debugLog({
                message:
                    'Detected stream extraction error, attempting recovery...',
            })

            try {
                const currentTrack = queue.currentTrack
                if (currentTrack) {
                    await recoverFromStreamExtractionError(queue, currentTrack)
                } else {
                    queue.node.skip()
                }
            } catch (recoveryError) {
                errorLog({
                    message: 'Failed to recover from stream extraction error:',
                    error: toErrorInstance(recoveryError),
                    data: toErrorDetails(recoveryError),
                })
                queue.node.skip()
            }
        }
    } catch (handlerError) {
        errorLog({
            message: 'Error in player error handler:',
            error: toErrorInstance(handlerError),
            data: toErrorDetails(handlerError),
        })
    }
}
