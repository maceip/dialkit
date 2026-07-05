import { useEffect } from 'react';
import { mountDevSessionHost } from '../dev-session/dev-session-host';

interface DevSessionHostProps {
  projectKey?: string;
}

export function DevSessionHost({ projectKey = 'default' }: DevSessionHostProps) {
  useEffect(() => {
    return mountDevSessionHost({ projectKey });
  }, [projectKey]);
  return null;
}
