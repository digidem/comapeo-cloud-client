import alertsRoutes from './alerts.js'
import observationsRoutes from './observations.js'
import projectsRoutes from './projects.js'
import rootRoutes from './root.js'
import serverInfoRoutes from './server-info.js'
import syncRoutes from './sync.js'

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyPluginOptions & { serverBearerToken: string, serverName: string, allowedProjects?: number | string[] }} opts
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {undefined | number | string[]} [allowedProjects=1]
 */

export default async function routes(
  /** @type {import('fastify').FastifyInstance} */ fastify,
  /** @type {RouteOptions} */ {
    // @ts-ignore
    serverBearerToken,
    serverName,
    allowedProjects = 1,
  },
) {
  // Create a common options object marked as any to bypass type-check errors
  const commonOpts = /** @type {any} */ ({
    serverBearerToken,
    serverName,
    allowedProjects,
  })

  // Register plugins using the common options where applicable
  // @ts-ignore
  fastify.register(rootRoutes)
  fastify.register(serverInfoRoutes, commonOpts)
  fastify.register(projectsRoutes, commonOpts)
  // For plugins that require only a subset of options, cast inline
  fastify.register(
    observationsRoutes,
    /** @type {any} */ ({ serverBearerToken }),
  )
  fastify.register(alertsRoutes, commonOpts)
  fastify.register(syncRoutes, commonOpts)
}
