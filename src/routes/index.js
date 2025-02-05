import { STATUS_CODES } from 'node:http'

import * as errors from '../errors.js'
import alertsRoutes from './alerts.js'
import authRoutes from './auth.js'
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
  fastify.setErrorHandler((error, _req, reply) => {
    /** @type {number} */
    let statusCode = error.statusCode || 500
    if (
      !Number.isInteger(statusCode) ||
      statusCode < 400 ||
      statusCode >= 600
    ) {
      statusCode = 500
    }

    const code = errors.normalizeCode(
      typeof error.code === 'string'
        ? error.code
        : STATUS_CODES[statusCode] || 'ERROR',
    )

    const { message = 'Server error' } = error

    reply.status(statusCode).send({ error: { code, message } })
  })

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
  fastify.register(authRoutes, commonOpts)
}
