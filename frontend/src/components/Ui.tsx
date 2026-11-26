import type React from 'react';
import { PageHeader as NavigationPageHeader } from './PageHeader';

export { Icon } from './Icon';
export { Badge } from './Badge';
export { Button } from './Button';
export { Field } from './Field';
export { Select } from './Select';
export { Table } from './Table';
export { Panel } from './Panel';

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return <NavigationPageHeader title={title} description={sub} actions={action} />;
}
