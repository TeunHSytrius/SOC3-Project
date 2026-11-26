export function Badge({ value, kind = 'neutral' }: { value: string; kind?: string }) {
  return <span className={'badge ' + kind}>{value}</span>;
}
