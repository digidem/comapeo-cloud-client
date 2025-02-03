import timingSafeEqual from 'string-timing-safe-equal'

import * as errors from '../errors.js'

export const BEARER_SPACE_LENGTH = 'Bearer '.length

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} req
 * @param {object} req.params
 * @param {string} req.params.projectPublicId
 * @returns {Promise<void>}
 */
export async function ensureProjectExists(fastify, req) {
  try {
    await fastify.comapeo.getProject(req.params.projectPublicId)
  } catch (e) {
    if (e instanceof Error && e.constructor.name === 'NotFoundError') {
      throw errors.projectNotFoundError()
    }
    throw e
  }
}

/**
 * @param {string} expectedBearerToken
 * @param {undefined | string} headerValue
 * @returns {boolean}
 */
export function isBearerTokenValid(expectedBearerToken, headerValue = '') {
  // This check is not strictly required for correctness, but helps protect
  // against long values.
  const expectedLength = BEARER_SPACE_LENGTH + expectedBearerToken.length
  if (headerValue.length !== expectedLength) return false

  if (!headerValue.startsWith('Bearer ')) return false
  const actualBearerToken = headerValue.slice(BEARER_SPACE_LENGTH)

  return timingSafeEqual(actualBearerToken, expectedBearerToken)
}

/**
 * @param {import('fastify').FastifyRequest} req
 * @param {string} serverBearerToken
 */
export const verifyBearerAuth = (req, serverBearerToken) => {
  if (!isBearerTokenValid(serverBearerToken, req.headers.authorization)) {
    throw errors.invalidBearerToken()
  }
}
