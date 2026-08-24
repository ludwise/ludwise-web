/**
 * Stable log event names.
 *
 * An event name is a contract: dashboards, saved queries and alerts key on it,
 * so once shipped it does not change. The human message beside it stays free to
 * be reworded. Collecting the names here makes the contract reviewable.
 *
 * Not every log line needs an entry - only those worth querying or alerting on.
 */
export const EVENTS = {
  HTTP_REQUEST_COMPLETED: 'http.request.completed',
  HTTP_REQUEST_FAILED: 'http.request.failed',
  CONFIG_INVALID: 'config.invalid',
  ACCESS_DENIED: 'access.denied',
  ANALYTICS_TRACK_FAILED: 'analytics.track_failed',
  APPLICATION_QUERY_FAILED: 'application.query_failed',
  CLOUDFLARE_REQUEST_FAILED: 'cloudflare.request_failed',
  PROVIDER_SYNC_STARTED: 'provider.sync.started',
  PROVIDER_SYNC_COMPLETED: 'provider.sync.completed',
  PROVIDER_SYNC_FAILED: 'provider.sync.failed',
  PROVIDER_SYNC_DENIED: 'provider.sync.denied',
  PROVIDER_SYNC_SKIPPED: 'provider.sync.skipped',
  PROVIDER_ITEM_FAILED: 'provider.item.failed',
  PROVIDER_MARKET_SKIPPED: 'provider.market.skipped',
  EMAIL_SEND_REQUESTED: 'email.send.requested',
  EMAIL_SEND_SUCCEEDED: 'email.send.succeeded',
  EMAIL_SEND_FAILED: 'email.send.failed',
} as const;

export type KnownEvent = (typeof EVENTS)[keyof typeof EVENTS];
