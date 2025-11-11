import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

let appInsights = null;

/**
 * Initialize Application Insights for frontend telemetry
 * Tracks page views, exceptions, custom events, and Web Vitals
 */
export function initTelemetry() {
  const connectionString = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    console.warn('VITE_APPINSIGHTS_CONNECTION_STRING not set. Telemetry disabled.');
    return null;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true, // Track SPA route changes
      enableCorsCorrelation: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
      disableFetchTracking: false,
      disableAjaxTracking: false,
      autoTrackPageVisitTime: true,
      enableUnhandledPromiseRejectionTracking: true
    }
  });

  appInsights.loadAppInsights();
  
  // Track initial page view
  appInsights.trackPageView();

  // Track Web Vitals
  trackWebVitals();

  console.log('Application Insights telemetry initialized');
  return appInsights;
}

/**
 * Track Web Vitals metrics
 */
function trackWebVitals() {
  if (!appInsights) return;

  onCLS((metric) => {
    appInsights.trackMetric({ name: 'CLS', average: metric.value });
  });

  onFID((metric) => {
    appInsights.trackMetric({ name: 'FID', average: metric.value });
  });

  onLCP((metric) => {
    appInsights.trackMetric({ name: 'LCP', average: metric.value });
  });

  onFCP((metric) => {
    appInsights.trackMetric({ name: 'FCP', average: metric.value });
  });

  onTTFB((metric) => {
    appInsights.trackMetric({ name: 'TTFB', average: metric.value });
  });
}

/**
 * Track a custom event
 * @param {string} name - Event name
 * @param {object} properties - Custom properties
 */
export function trackEvent(name, properties = {}) {
  if (appInsights) {
    appInsights.trackEvent({ name }, properties);
  }
}

/**
 * Track an exception
 * @param {Error} error - Error object
 * @param {object} properties - Custom properties
 */
export function trackException(error, properties = {}) {
  if (appInsights) {
    appInsights.trackException({ exception: error, properties });
  }
}

/**
 * Track a page view (for manual tracking)
 * @param {string} name - Page name
 * @param {string} uri - Page URI
 */
export function trackPageView(name, uri) {
  if (appInsights) {
    appInsights.trackPageView({ name, uri });
  }
}

/**
 * Set authenticated user context
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID (optional)
 */
export function setAuthenticatedUserContext(userId, accountId) {
  if (appInsights) {
    appInsights.setAuthenticatedUserContext(userId, accountId);
  }
}

/**
 * Clear authenticated user context
 */
export function clearAuthenticatedUserContext() {
  if (appInsights) {
    appInsights.clearAuthenticatedUserContext();
  }
}
