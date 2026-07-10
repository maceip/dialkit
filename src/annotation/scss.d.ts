declare module '*.module.scss' {
  const classNames: Record<string, string>;
  export default classNames;
}

declare module '*.scss' {
  const content: Record<string, never>;
  export default content;
}
