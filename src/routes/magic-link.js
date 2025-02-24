import { Type } from '@sinclair/typebox'

import { randomBytes } from 'node:crypto'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { verifyProjectAuth, BEARER_SPACE_LENGTH } from './utils.js'

const RATE_LIMIT = Date.now() - 60 * 60 * 1000 // 1 hour

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyPluginAsync} FastifyPluginAsync */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').FastifyReply} FastifyReply */
/** @typedef {import('fastify').RawServerDefault} RawServerDefault */
/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} ProjectRequest */

/**
 * Routes for handling magic link generation
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {object} opts - Route options
 * @param {string} opts.serverBearerToken - Bearer token for server authentication
 */
export default async function magicLinkRoutes(fastify, { serverBearerToken }) {
  fastify.post('/magic-link/:projectPublicId/create', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
      }),
      response: {
        200: Type.Object({
          magicLinkToken: Type.String(),
        }),
        '4xx': schemas.errorResponse,
      },
    },
    preHandler: /** @param {FastifyRequest} req */ async (req) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      fastify.log.debug('PreHandler: Verifying project authorization', {
        projectPublicId,
      })
      try {
        await verifyProjectAuth(req, serverBearerToken, projectPublicId)
        fastify.log.debug('PreHandler: Project authorization successful', {
          projectPublicId,
        })
      } catch {
        throw errors.invalidBearerToken()
      }
    },
    handler: /** @param {FastifyRequest} req */ async (req) => {
      fastify.log.debug('Handler: Received magic link creation request', {
        headers: req.headers,
      })
      // Retrieve userToken from header (supporting various header casings)
      let userToken = req.headers.authorization
      if (Array.isArray(userToken)) {
        userToken = userToken[0]
      }
      if (!userToken) {
        throw errors.unauthorizedError('Missing user token in header')
      }
      const token = userToken.slice(BEARER_SPACE_LENGTH)
      // Ensure the user hasn't generated a magic link in the past hour
      const existingLinks = fastify.db.getUserMagicLinks(token)
      const oneHourAgo = RATE_LIMIT
      if (
        existingLinks.some(
          (link) => new Date(link.createdAt).getTime() > oneHourAgo,
        )
      ) {
        fastify.log.error(
          'Handler: Rate limit exceeded for magic link generation',
          { token },
        )
        throw errors.tooManyMagicLinks(
          'A magic link was already generated in the past hour. Please try again later.',
        )
      }
      // Generate a new magic link token
      const magicLinkToken = randomBytes(32).toString('hex')
      // Store the new magic link token associated with the user
      fastify.db.addMagicLinkToken(token, magicLinkToken)
      fastify.log.debug('Handler: Magic link token stored successfully', {
        token,
        magicLinkToken,
      })

      return { magicLinkToken }
    },
  })
  fastify.post('/magic-link/auth/:magicToken', {
    schema: {
      params: Type.Object({
        magicToken: Type.String(),
      }),
      response: {
        200: Type.Object({
          magicLinkToken: Type.String(),
          user: Type.Any(),
          projectId: Type.String(),
        }),
        '4xx': schemas.errorResponse,
      },
    },
    handler: /** @param {import('fastify').FastifyRequest} req */ async (
      req,
    ) => {
      fastify.log.info(
        `Magic link auth handler started with params: ${JSON.stringify(req.params)}`,
      )
      const { magicToken } = /** @type {{ magicToken: string }} */ (req.params)
      if (!magicToken) {
        fastify.log.info(
          `Missing magic link token in params: ${JSON.stringify(req.params)}`,
        )
        throw errors.badRequestError(
          'Missing magic link token in request parameters',
        )
      }

      fastify.log.info(
        `Retrieving magic link token from DB for token: ${magicToken}`,
      )
      const magicLinkRecord = fastify.db.getMagicLinkToken(magicToken)
      if (!magicLinkRecord) {
        fastify.log.info(`No magic link token found for token: ${magicToken}`)
        throw errors.notFoundError('Invalid magic link token')
      }

      const { user: associatedUser, magicLink } = magicLinkRecord

      if (magicLink.used) {
        fastify.log.info(`Magic link token already used: ${magicToken}`)
        throw errors.badRequestError('Magic link token has already been used')
      }

      fastify.log.info(`Invalidating magic link token: ${magicToken}`)
      fastify.db.invalidateMagicLink(magicToken)
      fastify.log.info(
        `Magic link token invalidated successfully: ${magicToken}`,
      )

      const projects = await fastify.comapeo.listProjects()
      const project = projects.find(
        (p) => p.name === associatedUser.projectName,
      )
      if (!project) {
        fastify.log.error(
          `No project found for user with projectName: ${associatedUser.projectName}`,
        )
        throw errors.notFoundError(
          `No project found for user with projectName: ${associatedUser.projectName}`,
        )
      }
      const projectId = project.projectId

      return { magicLinkToken: magicToken, user: associatedUser, projectId }
    },
  })
}
