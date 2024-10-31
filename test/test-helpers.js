import createFastify from 'fastify'

import comapeoServer from '../src/app.js'

/** @import { FastifyInstance } from 'fastify' */
/** @import { TestContext } from 'node:test' */

/**
 * @param {TestContext} t
 * @returns {FastifyInstance}
 */
export function createTestServer(t) {
  const server = createFastify()
  t.after(() => server.close())

  server.register(comapeoServer)

  return server
}
