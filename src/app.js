import fastifySensible from '@fastify/sensible'
import fastifyWebsocket from '@fastify/websocket'
import createFastifyPlugin from 'fastify-plugin'

import allowedHostsPlugin from './allowed-hosts-plugin.js'
import baseUrlPlugin from './base-url-plugin.js'
import comapeoPlugin from './comapeo-plugin.js'
import dbPlugin from './db.js'
import mcpPlugin from './mcp.js'
import routes from './routes/index.js'

/** @import { FastifyPluginAsync } from 'fastify' */
/** @import { ComapeoPluginOptions } from './comapeo-plugin.js' */
/** @import { RouteOptions } from './routes/index.js' */

/**
 * @internal
 * @typedef {object} OtherServerOptions
 * @prop {string[]} [allowedHosts]
 * @prop {string} defaultStorage
 */

/**
 * @typedef {ComapeoPluginOptions & OtherServerOptions & RouteOptions} ServerOptions
 */

/** @type {FastifyPluginAsync<ServerOptions>} */
async function comapeoServer(
  fastify,
  {
    serverBearerToken,
    serverName,
    allowedHosts,
    allowedProjects,
    dbFolder,
    defaultStorage,
    ...comapeoPluginOpts
  },
) {
  await fastify.register(fastifySensible, { sharedSchemaId: 'HttpError' })
  await fastify.register(dbPlugin, { dbFolder: defaultStorage })
  await fastify.register(fastifyWebsocket)
  if (!fastify.db) {
    throw new Error('Database plugin failed to register')
  }
  await fastify.register(allowedHostsPlugin, { allowedHosts })
  await fastify.register(baseUrlPlugin)
  await fastify.register(comapeoPlugin, { ...comapeoPluginOpts, dbFolder })
  await fastify.register(mcpPlugin)
  await fastify.register(routes, {
    serverBearerToken,
    serverName,
    allowedProjects,
    defaultStorage,
  })
}

export default createFastifyPlugin(comapeoServer, {
  name: 'comapeoServer',
  fastify: '4.x',
})
