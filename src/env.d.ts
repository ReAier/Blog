/// <reference types="astro/client" />

declare global {
  interface Window {
    __aierFluidCleanup?: () => void;
  }
}

export {};
