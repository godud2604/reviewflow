'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CommandItem } from '@/components/ui/command';

export const FilterBadge = ({
  label,
  isActive,
  onClick,
  children,
}: {
  label: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        onClick={onClick}
        className={cn(
          'flex-shrink-0 h-8 px-3 rounded-[8px] text-[13px] font-medium transition-all flex items-center gap-1 border select-none',
          isActive
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
        )}
      >
        {label}
        {children && (
          <ChevronDown
            className={cn(
              'h-3 w-3 opacity-50 ml-0.5 transition-transform',
              isActive && 'opacity-100'
            )}
          />
        )}
      </button>
    </PopoverTrigger>
    {children && (
      <PopoverContent className="w-[200px] p-0" align="start">
        {children}
      </PopoverContent>
    )}
  </Popover>
);

export const FilterCheckboxItem = ({
  checked,
  children,
  onSelect,
}: {
  checked: boolean;
  children: React.ReactNode;
  onSelect: () => void;
}) => (
  <CommandItem onSelect={onSelect} className="py-2.5 cursor-pointer">
    <div
      className={cn(
        'mr-2.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors shadow-sm',
        checked
          ? 'bg-neutral-900 border-neutral-900 text-white'
          : 'bg-white border-neutral-200 hover:border-neutral-300'
      )}
    >
      <Check className={cn('h-3 w-3', checked ? 'opacity-100' : 'opacity-0')} />
    </div>
    <span
      className={cn(
        'flex-1 text-[13px]',
        checked ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-600'
      )}
    >
      {children}
    </span>
  </CommandItem>
);
