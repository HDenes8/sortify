// centralized configuration for different environments
// REACT_APP_API_BASE_URL and REACT_APP_RECAPTCHA_SITE_KEY should be set in an
// environment variable (e.g. .env or in the hosting provider's settings).
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
export const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

