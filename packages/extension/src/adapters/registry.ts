import type { SiteAdapter } from './types';

const adapters: SiteAdapter[] = [];

export function registerAdapter(adapter: SiteAdapter): void {
  adapters.push(adapter);
}

export function findAdapter(url: string): SiteAdapter | undefined {
  return adapters.find((a) => a.matches(url));
}