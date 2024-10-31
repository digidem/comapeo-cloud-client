import * as fs from 'node:fs'

/** @import { FastifyPluginAsync, RawServerDefault } from 'fastify' */
/** @import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox' */

const INDEX_HTML_PATH = new URL('./static/index.html', import.meta.url)

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {string[] | number} [allowedProjects=1]
 */

/** @type {FastifyPluginAsync<never, RawServerDefault, TypeBoxTypeProvider>} */
export default function routes(fastify) {
  fastify.get('/', (_req, reply) => {
    const stream = fs.createReadStream(INDEX_HTML_PATH)
    reply.header('Content-Type', 'text/html')
    reply.send(stream)
  })

  return Promise.resolve()
}
