import { twMerge } from 'tailwind-merge'

// Keeps the class-name strings and drops everything else (false, null, undefined, and a function className, which
// Base UI allows and which is not a class name). tailwind-merge then keeps the last of any conflicting pair.
export function cn(...inputs: unknown[]) {
  return twMerge(inputs.filter((input): input is string => typeof input === 'string' && input !== '').join(' '))
}
