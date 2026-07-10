/* eslint-disable @typescript-eslint/no-explicit-any */
/** Local-only stub — DialKit does not ship Agent Sync / MCP HTTP this sprint. */

export async function listSessions(_endpoint: string): Promise<any[]> {
  return [];
}

export async function createSession(_endpoint: string, url: string): Promise<any> {
  return { id: 'local', url };
}

export async function getSession(_endpoint: string, sessionId: string): Promise<any> {
  return { id: sessionId, annotations: [] };
}

export async function syncAnnotation(
  _endpoint: string,
  _sessionId: string,
  annotation: any,
): Promise<any> {
  return annotation;
}

export async function updateAnnotation(
  _endpoint: string,
  _annotationId: string,
  updates: any,
): Promise<any> {
  return updates;
}

export async function deleteAnnotation(_endpoint: string, _annotationId: string): Promise<void> {
  /* no-op */
}

export async function requestAction(_endpoint: string, _payload: any): Promise<void> {
  /* no-op */
}
