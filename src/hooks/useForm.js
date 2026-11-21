import { useCallback, useState } from 'react'

/**
 * Small form-state helper.
 * `validate(values)` returns an object of { field: message | undefined }.
 */
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }, [])

  /** Set a field directly (for non-input controls such as chip groups or file pickers). */
  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: typeof value === 'function' ? value(prev[name]) : value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }, [])

  /** Returns a submit handler that validates first and focuses the first invalid field. */
  const handleSubmit = (onValid) => (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const found = Object.fromEntries(Object.entries(validate(values)).filter(([, message]) => message))
    setErrors(found)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    return onValid(values)
  }

  const reset = useCallback((next) => {
    setValues(next)
    setErrors({})
  }, [])

  return { values, errors, setErrors, setValue, handleChange, handleSubmit, reset }
}
