import type { ReactNode } from 'react';
import { ConnectionLayoutContext, useConnectionLayout } from '../features/connections';

export const ConnectionLayoutProvider = ({ children }: { children: ReactNode }) => {
  const layout = useConnectionLayout();
  return (
    <ConnectionLayoutContext.Provider value={layout}>
      {children}
    </ConnectionLayoutContext.Provider>
  );
};
