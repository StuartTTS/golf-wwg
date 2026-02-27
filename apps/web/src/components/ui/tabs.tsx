'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound components must be used within <Tabs>');
  return ctx;
}

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, children, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={`flex border-b border-surface-500 bg-transparent ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface TabProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function Tab({ id, children, className = '' }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/30 ${
        isActive
          ? 'border-b-2 border-gold-500 text-gold-500'
          : 'text-surface-400 hover:text-surface-200'
      } ${className}`}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className = '' }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;

  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={id} className={className}>
      {children}
    </div>
  );
}
