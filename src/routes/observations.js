import { Type } from '@sinclair/typebox'

import * as schemas from '../schemas.js'
import { SUPPORTED_ATTACHMENT_TYPES } from './constants.js'
import { ensureProjectExists, verifyBearerAuth } from './utils.js'

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyPluginAsync} FastifyPluginAsync */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').RawServerDefault} RawServerDefault */

/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} ProjectRequest */
/** @typedef {{lat: number, lon: number, tags?: Record<string,any>, attachments?: Array<any>, metadata?: any}} RequestBody */

/**
 * @param {FastifyInstance} fastify
 * @param {object} opts
 * @param {string} opts.serverBearerToken
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
          data: Type.Array(
            Type.Object({
              docId: Type.String(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
              deleted: Type.Boolean(),
              lat: Type.Number(),
              lon: Type.Number(),
              attachments: Type.Array(
                Type.Object({
                  url: Type.String(),
                }),
              ),
              tags: Type.Object({}),
            }),
          ),
        }),
        '4xx': schemas.errorResponse,
      },
    },
    /**
     * @this {FastifyInstance}
     */
    async preHandler(req) {
      verifyBearerAuth(req, serverBearerToken)
      await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
    },
    /**
     * @this {FastifyInstance}
     */
    async handler(req) {
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
                  /** @type {any} */ (attachment.type),
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
      body: Type.Object({
        lat: Type.Number(),
        lon: Type.Number(),
        tags: Type.Object({}),
        attachments: Type.Array(Type.Object({})),
      }),
      response: {
        201: Type.Literal(''),
        '4xx': schemas.errorResponse,
      },
    },
    /**
     * @this {FastifyInstance}
     */
    async preHandler(req) {
      verifyBearerAuth(req, serverBearerToken)
      await ensureProjectExists(
        fastify,
        /** @type {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} */ (
          req
        ),
      )
    },
    /**
     * @this {FastifyInstance}
     * @param {ProjectRequest & {body: RequestBody}} req
     */
    async handler(req) {
      const { projectPublicId } = req.params
      const project = await fastify.comapeo.getProject(projectPublicId)

      const observationData = {
        schemaName: /** @type {const} */ ('observation'),
        ...req.body,
        attachments: (req.body.attachments || []).map((attachment) => ({
          ...attachment,
          hash: '', // Required by schema but not used
        })),
        tags: req.body.tags || {},
        metadata: req.body.metadata || {
          manualLocation: false,
          position: {
            mocked: false,
            timestamp: new Date().toISOString(),
            coords: {
              latitude: req.body.lat,
              longitude: req.body.lon,
            },
          },
        },
      }

      const response = await project.observation.create(observationData)
      return response
    },
  })
}
