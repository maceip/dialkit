export interface DialKitSourceMeta {
  file: string;
  line?: number;
  column?: number;
}

export interface DialKitTargetProps {
  'data-dialkit-id'?: string;
  'data-dialkit-source'?: string;
}

export function formatSourceMeta(source: DialKitSourceMeta): string {
  const parts = [source.file];
  if (source.line !== undefined) parts.push(String(source.line));
  if (source.column !== undefined) parts.push(String(source.column));
  return parts.join(':');
}

export function parseSourceMeta(raw: string | null | undefined): DialKitSourceMeta | null {
  if (!raw) return null;
  const [file, line, column] = raw.split(':');
  if (!file) return null;
  return {
    file,
    line: line ? Number(line) : undefined,
    column: column ? Number(column) : undefined,
  };
}

export function dialkitTarget(options?: {
  id?: string;
  source?: DialKitSourceMeta;
}): DialKitTargetProps {
  const props: DialKitTargetProps = {};
  if (options?.id) props['data-dialkit-id'] = options.id;
  if (options?.source) props['data-dialkit-source'] = formatSourceMeta(options.source);
  return props;
}
