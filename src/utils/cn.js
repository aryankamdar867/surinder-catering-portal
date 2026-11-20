import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about our custom theme tokens so conflicts resolve correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['ivory', 'forest', 'burgundy', 'gold', 'ink'].flatMap((c) =>
        ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((s) => `${c}-${s}`),
      ),
      shadow: ['card'],
      font: ['display'],
    },
  },
})

/**
 * Join class names, skipping falsy values. Later Tailwind classes override
 * earlier conflicting ones (e.g. cn('inline-flex', 'hidden') → 'hidden').
 */
export function cn(...classes) {
  return twMerge(classes.filter(Boolean).join(' '))
}
