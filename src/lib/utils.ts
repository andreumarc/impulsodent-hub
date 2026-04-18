import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 14) return 'Buenos días'
  if (hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}
