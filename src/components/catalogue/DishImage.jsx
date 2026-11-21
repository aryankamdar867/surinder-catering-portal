import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { getDishImageUrl } from '@/services/dishImageService.js'
import { cn } from '@/utils/cn.js'

/** Dish photo with a branded placeholder when there is no image (or it fails to load). */
export default function DishImage({ path, src, alt = '', className }) {
  const url = src ?? getDishImageUrl(path)
  const [failedUrl, setFailedUrl] = useState(null)

  if (!url || failedUrl === url) {
    return (
      <div className={cn('grid place-items-center bg-gradient-to-br from-ivory-100 to-ivory-200 text-gold-500', className)}>
        <UtensilsCrossed className="size-1/3 max-h-10 max-w-10" aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={cn('object-cover', className)}
    />
  )
}
