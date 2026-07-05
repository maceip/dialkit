import { DevSessionStore } from '../store/DevSessionStore';
import { mountDevSessionHost } from './dev-session-host';

export interface DevSessionBootstrapOptions {
  projectKey?: string;
}

export function bootstrapDevSession(options: DevSessionBootstrapOptions = {}): () => void {
  const projectKey = options.projectKey ?? 'default';
  DevSessionStore.configure(projectKey);
  return mountDevSessionHost({ projectKey });
}
