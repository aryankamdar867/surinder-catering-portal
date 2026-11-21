import { useEffect, useId, useMemo, useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import DishImage from './DishImage.jsx'
import Button from '@/components/ui/Button.jsx'
import { DISH_IMAGE_TYPES } from '@/constants/catalogue.js'

/**
 * Image chooser with preview. `file` is a newly chosen File (or null); `existingPath`
 * is the stored image. `removed` means the stored image should be cleared on save.
 */
export default function ImagePicker({ file, existingPath, removed, onSelect, onRemove, error, disabled }) {
  const inputRef = useRef(null)
  const id = useId()
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const hasImage = Boolean(previewUrl || (existingPath && !removed))

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-ink-700">
        Photo <span className="font-normal text-ink-400">(optional)</span>
      </span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <DishImage
          src={previewUrl ?? undefined}
          path={previewUrl || removed ? null : existingPath}
          alt="Dish preview"
          className="aspect-[4/3] w-full rounded-xl border border-ivory-200 sm:w-48"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={DISH_IMAGE_TYPES.join(',')}
            className="sr-only"
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              event.target.value = ''
              if (chosen) onSelect(chosen)
            }}
          />
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {hasImage ? 'Replace photo' : 'Add photo'}
          </Button>
          {hasImage && (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p className="text-xs font-medium text-burgundy-600">{error}</p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-ink-400">
          JPG, PNG, WebP or AVIF, up to 5 MB. A 4:3 landscape photo looks best.
        </p>
      )}
    </div>
  )
}
