import createFastifyPlugin from 'fastify-plugin'

import routes from './routes.js'

/** @import { FastifyPluginAsync } from 'fastify' */

/** @type {FastifyPluginAsync} */
function comapeoServer(fastify) {
  fastify.register(routes)

  return Promise.resolve()
}

export default createFastifyPlugin(comapeoServer, {
  name: 'comapeoServer',
  fastify: '4.x',
})
