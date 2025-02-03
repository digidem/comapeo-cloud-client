import { Type } from '@sinclair/typebox'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { SUPPORTED_ATTACHMENT_TYPES } from './constants.js'
import { ensureProjectExists, verifyBearerAuth } from './utils.js'

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyPluginAsync} FastifyPluginAsync */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').RawServerDefault} RawServerDefault */
/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} ProjectRequest */
/** @typedef {import('../schemas.js').ObservationToAdd} ObservationToAdd */
/** @typedef {import('../schemas.js').AttachmentQuerystring} AttachmentQuerystring */

/**
 * Routes for handling observations
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {object} opts - Route options
 * @param {string} opts.serverBearerToken - Bearer token for server authentication
 */
export default async function observationRoutes(
  fastify,
  { serverBearerToken },
) {
  fastify.get('/projects/:projectPublicId/observations', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(schemas.observationResult),
        }),
        '4xx': schemas.errorResponse,
      },
    },
    preHandler: async (req) => {
      verifyBearerAuth(req, serverBearerToken)
      await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
    },
    handler: async (req) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      const project = await fastify.comapeo.getProject(projectPublicId)

      return {
        data: (await project.observation.getMany({ includeDeleted: true })).map(
          (obs) => ({
            docId: obs.docId,
            createdAt: obs.createdAt,
            updatedAt: obs.updatedAt,
            deleted: obs.deleted,
            lat: obs.lat,
            lon: obs.lon,
            attachments: obs.attachments
              .filter((attachment) =>
                SUPPORTED_ATTACHMENT_TYPES.has(
                  /** @type {import('../schemas.js').Attachment['type']} */ (
                    attachment.type
                  ),
                ),
              )
              .map((attachment) => ({
                url: new URL(
                  `projects/${projectPublicId}/attachments/${attachment.driveDiscoveryId}/${attachment.type}/${attachment.name}`,
                  req.baseUrl,
                ).href,
              })),
            tags: obs.tags,
          }),
        ),
      }
    },
  })

  fastify.put('/projects/:projectPublicId/observation', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
      }),
      body: schemas.observationToAdd,
      response: {
        201: Type.Literal(''),
        '4xx': schemas.errorResponse,
      },
    },
    preHandler: async (req) => {
      verifyBearerAuth(req, serverBearerToken)
      await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
    },
    handler: async (req) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      const body = /** @type {ObservationToAdd} */ (req.body)
      const project = await fastify.comapeo.getProject(projectPublicId)

      const observationData = {
        schemaName: /** @type {const} */ ('observation'),
        lat: body.lat,
        lon: body.lon,
        attachments: (body.attachments || []).map((attachment) => ({
          ...attachment,
          hash: '', // Required by schema but not used
        })),
        tags: body.tags || {},
        metadata: body.metadata || {
          manualLocation: false,
          position: {
            mocked: false,
            timestamp: new Date().toISOString(),
            coords: {
              latitude: body.lat,
              longitude: body.lon,
            },
          },
        },
      }

      const response = await project.observation.create(observationData)
      return response
    },
  })

  fastify.get(
    '/projects/:projectPublicId/attachments/:driveDiscoveryId/:type/:name',
    {
      schema: {
        params: schemas.attachmentParams,
        querystring: schemas.attachmentQuerystring,
        response: {
          200: {},
          '4xx': schemas.errorResponse,
        },
      },
      preHandler: async (req) => {
        verifyBearerAuth(req, serverBearerToken)
        await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
      },
      handler: async (req, reply) => {
        const { projectPublicId, driveDiscoveryId, type, name } =
          /** @type {import('fastify').FastifyRequest<{Params: import('@sinclair/typebox').Static<typeof schemas.attachmentParams>}>} */ (
            req
          ).params
        const { variant } =
          /** @type {import('fastify').FastifyRequest<{Querystring: import('@sinclair/typebox').Static<typeof schemas.attachmentQuerystring>}>} */ (
            req
          ).query
        const project = await fastify.comapeo.getProject(projectPublicId)

        let typeAndVariant
        switch (type) {
          case 'photo':
            typeAndVariant = {
              type: /** @type {const} */ ('photo'),
              variant: variant || 'original',
            }
            break
          case 'audio':
            if (variant && variant !== 'original') {
              throw errors.badRequestError(
                'Cannot fetch this variant for audio attachments',
              )
            }
            typeAndVariant = {
              type: /** @type {const} */ ('audio'),
              variant: /** @type {const} */ ('original'),
            }
            break
          default:
            throw errors.shouldBeImpossibleError(/** @type {never} */ (type))
        }

        const blobUrl = await project.$blobs.getUrl({
          driveId: driveDiscoveryId,
          name,
          ...typeAndVariant,
        })

        const proxiedResponse = await fetch(blobUrl)
        reply.code(proxiedResponse.status)
        for (const [headerName, headerValue] of proxiedResponse.headers) {
          reply.header(headerName, headerValue)
        }
        return reply.send(proxiedResponse.body)
      },
    },
  )
}
