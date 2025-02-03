import { ensureProjectExists } from './utils.js'

export default async function syncRoutes(fastify) {
  fastify.get('/:projectId/status', {
    schema: {
      params: { projectId: { type: 'string' } },
    },
    async handler(req) {
      const { projectId } = req.params
      await ensureProjectExists(fastify, req)
      const status = await fastify.mapeoManager.syncStatus(projectId)
      return status
    },
  })
}
