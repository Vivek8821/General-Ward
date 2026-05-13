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
      'inline-flex h-auto w-full flex-wrap items-center justify-start gap-0 sm:flex-nowrap sm:overflow-x-auto border-b border-zinc-300 dark:border-zinc-800 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/**
 * variant="primary"  — high-frequency tabs: bolder text, indigo-tinted icon at rest
 * variant="default"  — standard tabs (unchanged baseline)
 * variant="muted"    — low-frequency tabs: dimmer, smaller, less visual weight
 */
const TabsTrigger = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const base = cn(
    'inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent -mb-px outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 rounded-t-md',
    // active state wins over all variant colours
    'data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:[&_svg]:text-indigo-600',
    'dark:data-[state=active]:border-indigo-400 dark:data-[state=active]:text-indigo-300 dark:data-[state=active]:[&_svg]:text-indigo-400',
  );

  const variants = {
    primary: cn(
      'px-4 py-3 text-sm font-bold',
      'text-zinc-700 dark:text-zinc-200 [&_svg]:text-indigo-400 dark:[&_svg]:text-indigo-400',
      'hover:text-indigo-600 dark:hover:text-indigo-300',
    ),
    default: cn(
      'px-4 py-3 text-sm font-semibold',
      'text-zinc-500 dark:text-zinc-400',
      'hover:text-zinc-800 dark:hover:text-zinc-100',
    ),
    muted: cn(
      'px-3 py-2.5 text-xs font-medium',
      'text-zinc-400 dark:text-zinc-500 [&_svg]:opacity-50',
      'hover:text-zinc-600 dark:hover:text-zinc-300 hover:[&_svg]:opacity-80',
    ),
  };

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(base, variants[variant] ?? variants.default, className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-0 outline-none min-h-[150px] relative transition-all duration-300', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

/** Thin vertical rule — place inside TabsList to separate priority tiers */
export function TabsDivider() {
  return (
    <div
      className="hidden sm:block self-stretch w-px bg-zinc-200 dark:bg-zinc-700/60 mx-2 my-2.5 shrink-0"
      role="none"
      aria-hidden="true"
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
