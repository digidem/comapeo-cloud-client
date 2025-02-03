import { Type } from '@sinclair/typebox'

// @ts-check
export const BEARER_SPACE_LENGTH = 'Bearer '.length
export const SUPPORTED_ATTACHMENT_TYPES = new Set(['photo', 'audio'])
export const BASE32_REGEX_32_BYTES = '^[0-9A-Za-z]{52}$'
export const BASE32_STRING_32_BYTES = Type.String({
  pattern: BASE32_REGEX_32_BYTES,
})
