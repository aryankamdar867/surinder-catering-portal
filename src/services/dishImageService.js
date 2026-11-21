import { supabase } from '@/lib/supabase.js'
import { DISH_IMAGE_MAX_BYTES, DISH_IMAGE_TYPES } from '@/constants/catalogue.js'

const BUCKET = 'dish-images'
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

/** Returns an error message, or undefined when the file is acceptable. Mirrors the bucket limits. */
export function validateDishImage(file) {
  if (!file) return undefined
  if (!DISH_IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or AVIF image.'
  if (file.size > DISH_IMAGE_MAX_BYTES) return 'Images must be 5 MB or smaller.'
  return undefined
}

/** Uploads to a fresh, unguessable path and returns that path (stored in dishes.image_path). */
export async function uploadDishImage(file) {
  const message = validateDishImage(file)
  if (message) throw new Error(message)
  const path = `dishes/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Best-effort cleanup; a leftover file is harmless, so failures are not surfaced. */
export async function removeDishImage(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

export function getDishImageUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
