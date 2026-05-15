/**
 * Debug and Telemetry Configuration
 * Extracted from debug-collector.js for potential future use
 */

export const DEBUG_CONFIG = {
  // Manus Debug Collector Configuration
  reportEndpoint: "/__manus__/logs",
  reportInterval: 2000, // milliseconds
  
  // Buffer sizes for different data types
  bufferSize: {
    console: 500,
    network: 200,
    ui: 500,
  },
  
  // Fields to redact from logs for security
  sensitiveFields: [
    "password",
    "token",
    "secret",
    "key",
    "authorization",
    "cookie",
    "session",
  ],
  
  // Maximum sizes for captured data
  maxBodyLength: 10240, // bytes
  uiInputMaxLen: 200, // characters
  uiTextMaxLen: 80, // characters
  
  // Throttling settings
  scrollThrottleMs: 500, // minimum ms between scroll events
};

/**
 * Beacon configuration for page unload
 */
export const BEACON_CONFIG = {
  maxSize: 60000, // bytes - ~64KB limit with margin
  prioritization: {
    consoleLogs: 50,
    networkRequests: 20,
    sessionEvents: 100,
    uiEvents: 100,
  },
};

/**
 * UI Event Types that are tracked
 */
export enum UIEventType {
  CLICK = "click",
  CHANGE = "change",
  FOCUS_IN = "focusin",
  FOCUS_OUT = "focusout",
  KEY_DOWN = "keydown",
  SUBMIT = "submit",
  SCROLL = "scroll",
  NAVIGATE = "navigate",
  ERROR = "error",
  NETWORK_ERROR = "network_error",
  UNHANDLED_REJECTION = "unhandledrejection",
}

/**
 * Console log levels tracked
 */
export enum LogLevel {
  LOG = "LOG",
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}
