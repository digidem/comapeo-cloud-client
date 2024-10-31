import fastifySensible from '@fastify/sensible'
import createFastifyPlugin from 'fastify-plugin'

import comapeoPlugin from './comapeo-plugin.js'
import routes from './routes.js'

/** @import { FastifyPluginAsync } from 'fastify' */
/** @import { ComapeoPluginOptions } from './comapeo-plugin.js' */
/** @import { RouteOptions } from './routes.js' */

/**
 * @typedef {ComapeoPluginOptions & RouteOptions} ServerOptions
 */

/** @type {FastifyPluginAsync<ServerOptions>} */
function comapeoServer(
  fastify,
  { serverBearerToken, serverName, ...comapeoPluginOpts },
) {
  fastify.register(fastifySensible, { sharedSchemaId: 'HttpError' })
  fastify.register(comapeoPlugin, comapeoPluginOpts)
  fastify.register(routes, {
    serverBearerToken,
    serverName,
  })

  return Promise.resolve()
}

export default createFastifyPlugin(comapeoServer, {
  name: 'comapeoServer',
  fastify: '4.x',
})
