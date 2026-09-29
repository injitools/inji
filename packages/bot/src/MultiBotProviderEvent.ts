/**
 * One raw update received from a social provider, stored verbatim. The (provider, eventId) pair is
 * the dedup key: an update that was already `executed` is skipped when the provider re-delivers it
 * (long-poll reconnects do that), and a failed one keeps its `error` for diagnosis.
 */
export default class MultiBotProviderEvent<T = any> {
    provider: string;
    eventId: string;
    type: string;
    date: Date;
    data: T;
    executed: boolean;
    error: string | null = null;
}
