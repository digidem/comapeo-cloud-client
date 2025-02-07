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
/**
 * Verifies authorization for project access
 * @param {import('fastify').FastifyRequest} req
 * @param {string} serverBearerToken
 * @param {string} [projectId]
 */
export const verifyProjectAuth = async (req, serverBearerToken, projectId) => {
  const authHeader = req.headers.authorization
  // First check if it's a valid server bearer token
  if (isBearerTokenValid(serverBearerToken, authHeader)) {
    return
  }

  // If not server token, must be member or coordinator token
  if (!authHeader?.startsWith('Bearer ')) {
    throw errors.invalidBearerToken()
  }

  const token = authHeader.slice(BEARER_SPACE_LENGTH)

  // Get fastify instance to access db
  const fastify = /** @type {import('fastify').FastifyInstance} */ (req.server)

  // Ensure projectId is provided
  if (!projectId) {
    throw errors.invalidBearerToken()
  }

  // Get project details
  let project
  try {
    project = await fastify.comapeo.getProject(projectId)
  } catch {
    throw errors.invalidBearerToken()
  }
  if (!project) {
    throw errors.invalidBearerToken()
  }

  const projectSettings = await project.$getProjectSettings()
  const projectName = projectSettings.name

  // Check if token belongs to a coordinator
  const coordinator = fastify.db
    .getCoordinators()
    .find((c) => c.token === token)

  if (coordinator) {
    // Verify project name matches
    if (projectName && coordinator.projectName !== projectName) {
      console.log('Project name mismatch:', {
        expected: projectName,
        actual: coordinator.projectName,
      })
      throw errors.invalidBearerToken()
    }
    return
  }

  // Check if token belongs to a member
  const member = fastify.db.getMembers().find((m) => m.token === token)

  if (member) {
    // Verify project name matches
    if (projectName && member.projectName !== projectName) {
      console.log('Project name mismatch:', {
        expected: projectName,
        actual: member.projectName,
      })
      throw errors.invalidBearerToken()
    }
    return
  }

  throw errors.invalidBearerToken()
}
