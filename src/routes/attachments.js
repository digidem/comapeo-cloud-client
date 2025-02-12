import { Type } from '@sinclair/typebox'
import sharp from 'sharp'

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { ensureProjectExists, verifyProjectAuth } from './utils.js'

const { join } = await import('node:path')

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').FastifyRequest<{ Params: { projectPublicId: string } }>} ProjectRequest */

/**
 * Routes for handling attachments.
 * @param {FastifyInstance} fastify
 * @param {{ serverBearerToken: string, defaultStorage: string }} opts
 */
export default async function attachmentsRoutes(
  fastify,
  { serverBearerToken, defaultStorage },
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
        200: Type.Object({
          driveId: Type.String(),
          name: Type.String(),
          type: Type.String(),
          hash: Type.String(),
        }),
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

      const token = process.env.WHATSAPP_TOKEN
      if (!token) {
        console.error('Missing WHATSAPP_TOKEN environment variable')
        throw new Error('WHATSAPP_TOKEN is not set in environment variables')
      }

      const whatsappUrl = `https://whatsapp.turn.io/v1/media/${mediaId}`
      const mediaResponse = await fetch(whatsappUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!mediaResponse.ok) {
        console.error('WhatsApp API request failed:', {
          status: mediaResponse.status,
          statusText: mediaResponse.statusText,
        })
        reply.code(mediaResponse.status)
        throw new Error(
          `Failed to fetch media from WhatsApp, status: ${mediaResponse.status}`,
        )
      }

      const buffer = Buffer.from(await mediaResponse.arrayBuffer())
      const mediaFolder = join(defaultStorage, 'media')
      if (!existsSync(mediaFolder)) {
        await mkdir(mediaFolder, { recursive: true })
      }

      const extension = mediaId.split('.').pop() || ''
      const extensionLower = extension.toLowerCase()
      /** @type {Record<string, string>} */
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        mp4: 'video/mp4',
        webm: 'video/webm',
      }
      const mimeType = mimeTypes[extensionLower] || 'application/octet-stream'

      const filePath = join(mediaFolder, mediaId)
      const fileThumbnailPath = join(mediaFolder, `thumbnail_${mediaId}`)

      // Write original file
      await writeFile(filePath, buffer)

      // If the media is an image, compress it to create a thumbnail
      // THUMBNAIL_SIZE = 400; THUMBNAIL_QUALITY = 30;
      let thumbnailPath = filePath
      if (mimeType.startsWith('image/')) {
        try {
          await sharp(buffer)
            .resize({ width: 400, fit: 'inside' })
            .jpeg({ quality: 30 })
            .toFile(fileThumbnailPath)
          thumbnailPath = fileThumbnailPath
        } catch (error) {
          console.error('Error generating thumbnail:', error)
          // Fallback: use original image if thumbnail generation fails
          thumbnailPath = filePath
        }
      }

      const project = await fastify.comapeo.getProject(projectPublicId)
      const blobCreationResponse = await project.$blobs.create(
        {
          original: new URL(`file://${filePath}`).pathname,
          thumbnail: new URL(`file://${thumbnailPath}`).pathname,
        },
        {
          mimeType,
          timestamp: Date.now(),
        },
      )
      return blobCreationResponse
    },
  })
}
