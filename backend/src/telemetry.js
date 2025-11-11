import appInsights from 'applicationinsights';

/**
 * Initialize Application Insights telemetry
 * Automatically captures:
 * - HTTP requests/responses
 * - Exceptions
 * - Dependencies (Postgres, HTTP calls)
 * - Custom events and metrics
 */
export function initTelemetry() {
  const connectionString = process.env.APPINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    console.warn('APPINSIGHTS_CONNECTION_STRING not set. Telemetry disabled.');
    return null;
  }

  appInsights.setup(connectionString)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .start();

  const client = appInsights.defaultClient;
  
  // Set cloud role name for Application Map
  client.context.tags[client.context.keys.cloudRole] = 
    process.env.APPLICATIONINSIGHTS_ROLE_NAME || 'jdimpresion-api';

  console.log('Application Insights telemetry initialized');
  return client;
}

/**
 * Track a custom event
 * @param {string} name - Event name
 * @param {object} properties - Custom properties
 * @param {object} measurements - Custom measurements
 */
export function trackEvent(name, properties = {}, measurements = {}) {
  const client = appInsights.defaultClient;
  if (client) {
    client.trackEvent({ name, properties, measurements });
  }
}

/**
 * Track a custom metric
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 */
export function trackMetric(name, value) {
  const client = appInsights.defaultClient;
  if (client) {
    client.trackMetric({ name, value });
  }
}

/**
 * Track an exception
 * @param {Error} error - Error object
 * @param {object} properties - Custom properties
 */
export function trackException(error, properties = {}) {
  const client = appInsights.defaultClient;
  if (client) {
    client.trackException({ exception: error, properties });
  }
}
