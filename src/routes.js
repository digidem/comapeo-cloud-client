import { Type } from '@sinclair/typebox'

import * as fs from 'node:fs'

/** @import { FastifyInstance, FastifyPluginAsync, RawServerDefault } from 'fastify' */
/** @import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox' */

const INDEX_HTML_PATH = new URL('./static/index.html', import.meta.url)

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {string[] | number} [allowedProjects=1]
 */

/** @type {FastifyPluginAsync<RouteOptions, RawServerDefault, TypeBoxTypeProvider>} */
export default function routes(fastify, { serverName }) {
  fastify.get('/', (_req, reply) => {
    const stream = fs.createReadStream(INDEX_HTML_PATH)
    reply.header('Content-Type', 'text/html')
    reply.send(stream)
  })

  fastify.get(
    '/info',
    {
      schema: {
        response: {
          200: Type.Object({
            data: Type.Object({
              deviceId: Type.String(),
              name: Type.String(),
            }),
          }),
          500: { $ref: 'HttpError' },
        },
      },
    },
    /**
     * @this {FastifyInstance}
     */
    function () {
      const { deviceId, name } = this.comapeo.getDeviceInfo()
      return {
        data: { deviceId, name: name || serverName },
      }
    },
  )

  return Promise.resolve()
}
