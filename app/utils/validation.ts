type NumberValidationOptions = {
  min?: number
  max?: number
  integer?: boolean
  allowZero?: boolean
}

type TextValidationOptions = {
  minLength?: number
  maxLength?: number
  allowEmpty?: boolean
  pattern?: RegExp
}

type ChoiceValidationOptions = {
  allowEmpty?: boolean
}

type FileValidationOptions = {
  maxBytes?: number
  allowEmpty?: boolean
}

function textValue(value: unknown) {
  return String(value ?? '').trim()
}

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isValidClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hours, minutes] = value.split(':').map(Number)
  return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
}

export function requireText(value: unknown, field: string, options: TextValidationOptions = {}) {
  const trimmed = textValue(value)

  if (!trimmed) {
    if (options.allowEmpty) {
      return ''
    }

    throw new Error(`${field} is required.`)
  }

  if (options.minLength && trimmed.length < options.minLength) {
    throw new Error(`${field} must be at least ${options.minLength} characters long.`)
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new Error(`${field} must be ${options.maxLength} characters or fewer.`)
  }

  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new Error(`${field} has an invalid format.`)
  }

  return trimmed
}

export function requireChoice(value: unknown, field: string, allowedValues: string[], options: ChoiceValidationOptions = {}) {
  const trimmed = textValue(value)
  if (!trimmed) {
    if (options.allowEmpty) {
      return ''
    }

    throw new Error(`${field} is required.`)
  }

  if (!allowedValues.includes(trimmed)) {
    throw new Error(`Choose a valid ${field.toLowerCase()}.`)
  }

  return trimmed
}

export function requireNumber(value: unknown, field: string, options: NumberValidationOptions = {}) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a valid number.`)
  }

  if (options.integer && !Number.isInteger(number)) {
    throw new Error(`${field} must be a whole number.`)
  }

  if (options.allowZero === false && number === 0) {
    throw new Error(`${field} must be greater than zero.`)
  }

  if (typeof options.min === 'number' && number < options.min) {
    throw new Error(`${field} must be at least ${options.min}.`)
  }

  if (typeof options.max === 'number' && number > options.max) {
    throw new Error(`${field} must be at most ${options.max}.`)
  }

  return number
}

export function requireDate(value: unknown, field = 'Date') {
  const trimmed = requireText(value, field)
  if (!isValidCalendarDate(trimmed)) {
    throw new Error(`${field} must be a valid date.`)
  }
  return trimmed
}

export function requireTime(value: unknown, field = 'Time') {
  const trimmed = requireText(value, field)
  if (!isValidClockTime(trimmed)) {
    throw new Error(`${field} must be a valid time.`)
  }
  return trimmed
}

export function requireCurrencyCode(value: unknown, field = 'Currency') {
  const trimmed = requireText(value, field, { maxLength: 3 })
  const upper = trimmed.toUpperCase()
  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new Error(`${field} must be a 3-letter currency code.`)
  }
  return upper
}

export function requireTimezone(value: unknown, field = 'Timezone') {
  const trimmed = requireText(value, field)

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed })
    return trimmed
  } catch {
    throw new Error(`${field} must be a valid IANA timezone.`)
  }
}

export function validateImageFile(file: File | null | undefined, field: string, options: FileValidationOptions = {}) {
  if (!file) {
    if (options.allowEmpty) {
      return null
    }

    throw new Error(`${field} is required.`)
  }

  if (!file.type.startsWith('image/')) {
    throw new Error(`${field} must be an image file.`)
  }

  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error(`${field} must be smaller than ${Math.round(maxBytes / (1024 * 1024))} MB.`)
  }

  return file
}
