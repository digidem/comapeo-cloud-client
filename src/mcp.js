import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { Sessions } from 'fastify-mcp'
import createFastifyPlugin from 'fastify-plugin'

/** @import { FastifyPluginAsync, FastifyRequest } from "fastify" */
/** @import {MapeoManager} from "@comapeo/core" */

/**
 * @typedef {object} mcpPluginOptions
 */

/** @type {FastifyPluginAsync<mcpPluginOptions>} */
const mcpPluginCallback = async (fastify) => {
  const manager = fastify.comapeo
  const server = createServer(manager)
  const sessions = new Sessions()
  const sseEndpoint = '/sse'
  const messagesEndpoint = '/messages'

  fastify.get(sseEndpoint, async (_, reply) => {
    const transport = new SSEServerTransport(messagesEndpoint, reply.raw)
    const sessionId = transport.sessionId

    sessions.add(sessionId, transport)

    reply.raw.on('close', () => {
      sessions.remove(sessionId)
    })

    fastify.log.info('Starting new session', { sessionId })
    await server.connect(transport)
  })

  fastify.post(messagesEndpoint, async (req, reply) => {
    const sessionId = extractSessionId(req)
    if (!sessionId) {
      reply.status(400).send({ error: 'Invalid session' })
      return
    }

    const transport = sessions.get(sessionId)
    if (!transport) {
      reply.status(400).send({ error: 'Invalid session' })
      return
    }

    await transport.handlePostMessage(req.raw, reply.raw, req.body)
  })
}

export default createFastifyPlugin(mcpPluginCallback, {
  name: 'comapeo-mcp',
})

/**
 * @param {MapeoManager} manager
 */
export function createServer(manager) {
  const mcpServer = new McpServer({
    name: 'CoMapeo Cloud Project',
    version: '1.0.0',
    capabilities: {
      resources: {},
      tools: {},
    },
  })

  async function getProject() {
    // List projects
    const projects = await manager.listProjects()
    // Throw if none
    if (!projects.length) throw new Error('No projects exist on this instance')
    // Get first
    // @ts-ignore
    const { projectId } = projects[0]
    return manager.getProject(projectId)
  }

  // TODO: Search parameters (tags/presets?)
  mcpServer.tool(
    'search-observations',
    "Search through all the project's observations",
    {},
    async () => {
      try {
        const project = await getProject()
        const observations = await project.observation.getMany()
        const text = await JSON.stringify(observations)
        return {
          content: [{ type: 'text', text }],
        }
      } catch (e) {
        if (!(e instanceof Error)) {
          throw new Error('This should never happen, typescript!')
        }
        return {
          content: [
            {
              type: 'text',
              text: `Failed to search observations: ${e.message}`,
            },
          ],
        }
      }
    },
  )
  // mcpServer.resource("...");

  return mcpServer.server
}

/**
 * @param {FastifyRequest} req
 */
function extractSessionId(req) {
  if (typeof req.query !== 'object' || req.query === null) {
    return null
  }

  if ('sessionId' in req.query === false) {
    return null
  }

  const sessionId = req.query.sessionId
  if (typeof sessionId !== 'string') {
    return null
  }

  return sessionId
}
