import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-auto w-full flex-wrap items-center justify-start gap-0 sm:flex-nowrap sm:overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 border-b-2 border-transparent -mb-px outline-none transition-colors',
      'hover:text-zinc-900 dark:hover:text-zinc-100',
      'focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 rounded-t-md',
      'data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:border-indigo-400 dark:data-[state=active]:text-indigo-300',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-0 outline-none min-h-[150px] relative transition-all duration-300', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
