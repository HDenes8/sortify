// centralized configuration for different environments
// REACT_APP_API_BASE_URL and REACT_APP_RECAPTCHA_SITE_KEY should be set in an
// environment variable (e.g. .env or in the hosting provider's settings).

import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
export const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

// Configure axios globally: set base URL for API calls and enable credentials (cookies)
if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}
axios.defaults.withCredentials = true; // Required for session-based auth with cookies

//lets try this

