import * as fs from 'node:fs'

const INDEX_HTML_PATH = new URL('../static/index.html', import.meta.url)

/** @type {import('fastify').FastifyPluginAsync} */
export default async function rootRoutes(fastify) {
  fastify.get('/', (_req, reply) => {
    const stream = fs.createReadStream(INDEX_HTML_PATH)
    reply.header('Content-Type', 'text/html')
    reply.send(stream)
  })
}
