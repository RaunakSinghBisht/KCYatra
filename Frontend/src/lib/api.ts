/**
 * Central API config.
 * To switch environments, only change VITE_API_BASE_URL in .env / .env.production
 * Never hardcode localhost or any host directly in components — import BASE_URL from here.
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
