import { Type } from '@sinclair/typebox'

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { ensureProjectExists, verifyProjectAuth } from './utils.js'

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').FastifyRequest<{ Params: { projectPublicId: string } }>} ProjectRequest */

/**
 * Routes for handling attachments.
 * @param {FastifyInstance} fastify
 * @param {{ serverBearerToken: string }} opts
 */
export default async function attachmentsRoutes(
  fastify,
  { serverBearerToken },
) {
  fastify.get(
    '/projects/:projectPublicId/attachments/:driveDiscoveryId/:type/:name',
    {
      schema: {
        params: schemas.attachmentParams,
        querystring: schemas.attachmentQuerystring,
        response: {
          200: {},
          '4xx': schemas.errorResponse,
        },
      },
      preHandler: async (req, reply) => {
        const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
        try {
          await verifyProjectAuth(req, serverBearerToken, projectPublicId)
        } catch {
          reply.code(401)
          throw errors.invalidBearerToken()
        }
        await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
      },
      handler: async (req, reply) => {
        const { projectPublicId, driveDiscoveryId, type, name } =
          /** @type {import('fastify').FastifyRequest<{ Params: import('@sinclair/typebox').Static<typeof schemas.attachmentParams> }>} */ (
            req
          ).params
        const { variant } =
          /** @type {import('fastify').FastifyRequest<{ Querystring: import('@sinclair/typebox').Static<typeof schemas.attachmentQuerystring> }>} */ (
            req
          ).query
        const project = await fastify.comapeo.getProject(projectPublicId)

        let typeAndVariant
        switch (type) {
          case 'photo':
            typeAndVariant = {
              type: /** @type {const} */ ('photo'),
              variant: variant || 'original',
            }
            break
          case 'audio':
            if (variant && variant !== 'original') {
              throw errors.badRequestError(
                'Cannot fetch this variant for audio attachments',
              )
            }
            typeAndVariant = {
              type: /** @type {const} */ ('audio'),
              variant: /** @type {const} */ ('original'),
            }
            break
          default:
            throw errors.shouldBeImpossibleError(/** @type {never} */ (type))
        }

        const blobUrl = await project.$blobs.getUrl({
          driveId: driveDiscoveryId,
          name,
          ...typeAndVariant,
        })

        const proxiedResponse = await fetch(blobUrl)
        reply.code(proxiedResponse.status)
        // @ts-ignore
        for (const [headerName, headerValue] of proxiedResponse.headers) {
          reply.header(headerName, headerValue)
        }
        return reply.send(proxiedResponse.body)
      },
    },
  )

  fastify.post('/projects/:projectPublicId/whatsapp/attachments', {
    schema: {
      params: Type.Object({ projectPublicId: Type.String() }),
      body: Type.Object({ mediaId: Type.String() }),
      response: {
        200: Type.Any(),
        '4xx': schemas.errorResponse,
      },
    },
    preHandler: async (req, reply) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      try {
        await verifyProjectAuth(req, serverBearerToken, projectPublicId)
      } catch {
        reply.code(401)
        throw errors.invalidBearerToken()
      }
      await ensureProjectExists(fastify, /** @type {ProjectRequest} */ (req))
    },
    handler: async (req, reply) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      const { mediaId } =
        /** @type {import('fastify').FastifyRequest<{ Body: { mediaId: string } }>} */ (
          req
        ).body

      // Construct WhatsApp API URL and use the token from .env
      const whatsappUrl = `https://whatsapp.turn.io/v1/media/${mediaId}`
      const token = process.env.WHATSAPP_TOKEN
      if (!token) {
        throw new Error('WHATSAPP_TOKEN is not set in environment variables')
      }
      const mediaResponse = await fetch(whatsappUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!mediaResponse.ok) {
        reply.code(mediaResponse.status)
        throw new Error(
          `Failed to fetch media from WhatsApp, status: ${mediaResponse.status}`,
        )
      }
      const arrayBuffer = await mediaResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Determine media folder using DEFAULT_STORAGE from .env and store the file
      const { join } = await import('node:path')
      const defaultStorage = process.env.DEFAULT_STORAGE
      if (!defaultStorage) {
        throw new Error('DEFAULT_STORAGE is not set in environment variables')
      }
      const mediaFolder = join(defaultStorage, 'media')
      if (!existsSync(mediaFolder)) {
        await mkdir(mediaFolder, { recursive: true })
      }

      // Use mediaId as file name with .mp4 extension
      // Extract file extension from mediaId
      const extension = mediaId.split('.').pop() || ''
      // Determine mime type based on extension
      const extensionLower = extension.toLowerCase()
      /** @type {Record<string, string>} */
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        // Audio formats
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        // Video formats
        mp4: 'video/mp4',
        webm: 'video/webm',
      }
      const mimeType = mimeTypes[extensionLower] || 'application/octet-stream'
      const filePath = join(mediaFolder, mediaId) // Use original mediaId with extension
      await writeFile(filePath, buffer)

      // Build attachment object with file URI and current timestamp
      const attachment = {
        uri: new URL(`file://${filePath}`).toString(),
        createdAt: new Date().toISOString(),
      }

      const project = await fastify.comapeo.getProject(projectPublicId)
      const blobCreationResponse = await project.$blobs.create(
        {
          original: new URL(attachment.uri).pathname,
        },
        {
          mimeType,
          timestamp: Date.parse(attachment.createdAt),
        },
      )

      return blobCreationResponse
    },
  })
}
