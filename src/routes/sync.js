import { replicateProject } from '@comapeo/core'
import { Type } from '@sinclair/typebox'

import * as schemas from '../schemas.js'
import { wsCoreReplicator } from '../ws-core-replicator.js'
import { BASE32_STRING_32_BYTES } from './constants.js'
import { ensureProjectExists } from './utils.js'

/** @type {import('fastify').FastifyPluginAsync} */
export default async function syncRoutes(fastify) {
  fastify.get(
    '/sync/:projectPublicId',
    {
      schema: {
        params: Type.Object({
          projectPublicId: BASE32_STRING_32_BYTES,
        }),
        response: {
          '4xx': schemas.errorResponse,
        },
      },
      async preHandler(req) {
        await ensureProjectExists(
          this,
          /** @type {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} */ (
            req
          ),
        )
      },
      websocket: true,
    },
    /**
     * @this {import('fastify').FastifyInstance}
     */
    async function (socket, req) {
      // The preValidation hook ensures that the project exists
      const project = await this.comapeo.getProject(
        /** @type {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} */ (
          req
        ).params.projectPublicId,
      )
      const replicationStream = replicateProject(project, false)
      wsCoreReplicator(socket, replicationStream)
      project.$sync.start()
    },
  )
}
