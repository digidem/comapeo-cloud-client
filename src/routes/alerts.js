import { Type } from '@sinclair/typebox'

import * as schemas from '../schemas.js'
import { BASE32_STRING_32_BYTES } from './constants.js'
import { ensureProjectExists, verifyBearerAuth } from './utils.js'

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {undefined | number | string[]} [allowedProjects=1]
 */
/** @type {import('fastify').FastifyPluginAsync<RouteOptions>} */
export default async function alertRoutes(fastify, { serverBearerToken }) {
  fastify.get(
    '/projects/:projectPublicId/remoteDetectionAlerts',
    {
      schema: {
        params: Type.Object({
          projectPublicId: BASE32_STRING_32_BYTES,
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                docId: Type.String(),
                createdAt: Type.String(),
                updatedAt: Type.String(),
                deleted: Type.Boolean(),
                detectionDateStart: Type.String(),
                detectionDateEnd: Type.String(),
                sourceId: Type.String(),
                metadata: Type.Record(Type.String(), Type.Any()),
                geometry: Type.Any(),
              }),
            ),
          }),
          '4xx': schemas.errorResponse,
        },
      },
      async preHandler(req) {
        verifyBearerAuth(req, serverBearerToken)
        await ensureProjectExists(
          fastify,
          /** @type {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} */ (
            req
          ),
        )
      },
    },
    async (req) => {
      const { projectPublicId } = /** @type {any} */ (req.params)
      const project = await fastify.comapeo.getProject(projectPublicId)

      return {
        data: (
          await project.remoteDetectionAlert.getMany({ includeDeleted: true })
        ).map((alert) => ({
          docId: alert.docId,
          createdAt: alert.createdAt,
          updatedAt: alert.updatedAt,
          deleted: alert.deleted,
          detectionDateStart: alert.detectionDateStart,
          detectionDateEnd: alert.detectionDateEnd,
          sourceId: alert.sourceId,
          metadata: alert.metadata,
          geometry: alert.geometry,
        })),
      }
    },
  )

  fastify.post(
    '/projects/:projectPublicId/remoteDetectionAlerts',
    {
      schema: {
        params: Type.Object({
          projectPublicId: BASE32_STRING_32_BYTES,
        }),
        body: schemas.remoteDetectionAlertToAdd,
        response: {
          201: Type.Literal(''),
          '4xx': schemas.errorResponse,
        },
      },
      async preHandler(req) {
        verifyBearerAuth(req, serverBearerToken)
        await ensureProjectExists(
          fastify,
          /** @type {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} */ (
            req
          ),
        )
      },
    },
    /**
     * @this {import('fastify').FastifyInstance}
     */
    async function (req) {
      const { projectPublicId } = /** @type {any} */ (req.params)
      const project = await this.comapeo.getProject(projectPublicId)

      try {
        const response = await project.remoteDetectionAlert.create({
          schemaName: 'remoteDetectionAlert',
          .../** @type {any} */ (req.body),
        })
        return response
      } catch (err) {
        console.error('Failed to create remote detection alert:', err)
        throw err
      }
    },
  )
}
