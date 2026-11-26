import type React from 'react';
import { EmptyState } from './PageStates';

export function Table({
  head,
  children,
  empty = false,
}: {
  head: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {head.map((heading, columnIndex) => (
              <th scope="col" key={columnIndex}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <EmptyState
          title="Geen resultaten"
          description="Pas de filters aan of voeg gegevens toe."
        />
      )}
    </div>
  );
}
