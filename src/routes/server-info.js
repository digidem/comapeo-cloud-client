import { Type } from '@sinclair/typebox'

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {undefined | number | string[]} [allowedProjects=1]
 */

/** @import { FastifyInstance, FastifyPluginAsync, FastifyRequest, RawServerDefault } from 'fastify' */
/** @type {FastifyPluginAsync<RouteOptions, RawServerDefault>} */

export default async function serverInfoRoutes(fastify, { serverName }) {
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
}
