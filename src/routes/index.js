// @ts-check

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyPluginOptions & { serverBearerToken: string, serverName: string, allowedProjects?: number | string[] }} opts
 */
import alertsRoutes from './alerts.js'
import observationsRoutes from './observations.js'
import projectsRoutes from './projects.js'
import rootRoutes from './root.js'
import serverInfoRoutes from './server-info.js'
import syncRoutes from './sync.js'

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {undefined | number | string[]} [allowedProjects=1]
 */

export default async function routes(
  /** @type {import('fastify').FastifyInstance} */ fastify,
  /** @type {RouteOptions} */ {
    serverBearerToken,
    serverName,
    allowedProjects = 1,
  },
) {
  fastify.register(rootRoutes)
  fastify.register(serverInfoRoutes, {
    serverBearerToken,
    serverName,
    allowedProjects,
  })
  fastify.register(projectsRoutes, {
    serverBearerToken,
    serverName,
    allowedProjects,
  })
  fastify.register(observationsRoutes, { serverBearerToken })
  fastify.register(alertsRoutes, {
    serverBearerToken,
    serverName,
    allowedProjects,
  })
  fastify.register(syncRoutes, {
    serverBearerToken,
    serverName,
    allowedProjects,
  })
}
