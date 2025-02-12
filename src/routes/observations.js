import { Type } from '@sinclair/typebox'
import slugify from '@sindresorhus/slugify'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { SUPPORTED_ATTACHMENT_TYPES } from './constants.js'
import { ensureProjectExists, verifyProjectAuth } from './utils.js'

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyPluginAsync} FastifyPluginAsync */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').RawServerDefault} RawServerDefault */
/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} ProjectRequest */
/** @typedef {import('../schemas.js').ObservationToAdd} ObservationToAdd */
/** @typedef {import('../schemas.js').observationToUpdate} ObservationToUpdate */
/** @typedef {import('../schemas.js').AttachmentQuerystring} AttachmentQuerystring */
/** @typedef {import('../schemas.js').Attachment} Attachment */

/**
 * Routes for handling observations
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {object} opts - Route options
 * @param {string} opts.serverBearerToken - Bearer token for server authentication
 */
export default async function observationRoutes(
  fastify,
  { serverBearerToken },
) {
  fastify.get('/projects/:projectPublicId/observation/:docId', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
        docId: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: schemas.observationResult,
        }),
        404: schemas.errorResponse,
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
    handler: async (req) => {
      const { projectPublicId, docId } =
        /** @type {import('fastify').FastifyRequest<{ Params: { projectPublicId: string, docId: string } }>} */ (
          req
        ).params
      const project = await fastify.comapeo.getProject(projectPublicId)

      const observation = await project.observation.getByDocId(docId)
      if (!observation) {
        throw errors.notFoundError('Observation not found')
      }

      return {
        data: {
          docId: observation.docId,
          createdAt: observation.createdAt,
          updatedAt: observation.updatedAt,
          deleted: observation.deleted,
          lat: observation.lat,
          lon: observation.lon,
          attachments: observation.attachments
            .filter((attachment) =>
              SUPPORTED_ATTACHMENT_TYPES.has(
                /** @type {import('../schemas.js').Attachment['type']} */ (
                  attachment.type
                ),
              ),
            )
            .map((attachment) => ({
              url: new URL(
                `projects/${projectPublicId}/attachments/${attachment.driveDiscoveryId}/${attachment.type}/${attachment.name}`,
                req.baseUrl,
              ).href,
            })),
          tags: observation.tags,
        },
      }
    },
  })
  fastify.get('/projects/:projectPublicId/observations', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(schemas.observationResult),
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
    handler: async (req) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      const project = await fastify.comapeo.getProject(projectPublicId)

      return {
        data: (await project.observation.getMany({ includeDeleted: true })).map(
          (obs) => ({
            docId: obs.docId,
            createdAt: obs.createdAt,
            updatedAt: obs.updatedAt,
            deleted: obs.deleted,
            lat: obs.lat,
            lon: obs.lon,
            attachments: obs.attachments
              .filter((attachment) =>
                SUPPORTED_ATTACHMENT_TYPES.has(
                  /** @type {import('../schemas.js').Attachment['type']} */ (
                    attachment.type
                  ),
                ),
              )
              .map((attachment) => ({
                url: new URL(
                  `projects/${projectPublicId}/attachments/${attachment.driveDiscoveryId}/${attachment.type}/${attachment.name}`,
                  req.baseUrl,
                ).href,
              })),
            tags: obs.tags,
          }),
        ),
      }
    },
  })

  fastify.put('/projects/:projectPublicId/observation', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
      }),
      querystring: Type.Object({
        docId: Type.Optional(Type.String()),
        versionId: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        locale: Type.Optional(Type.String()),
      }),
      body: Type.Optional(
        Type.Union([schemas.observationToAdd, schemas.observationToUpdate]),
      ),
      response: {
        200: Type.Object({
          versionId: Type.String(),
          docId: Type.String(),
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
    handler: async (req) => {
      const { projectPublicId } = /** @type {ProjectRequest} */ (req).params
      const { docId, versionId, category, locale } =
        /** @type {import('fastify').FastifyRequest<{Querystring: {docId?: string, versionId?: string, category?: string, locale?: string}}>} */ (
          req
        ).query
      const project = await fastify.comapeo.getProject(projectPublicId)

      let preset
      if (category) {
        const presets = await project.preset.getMany({ lang: locale || 'en' })
        preset = presets.find(
          (p) =>
            slugify(p.name, { lowercase: true }) ===
            slugify(category, { lowercase: true }),
        )
        if (!preset) {
          throw errors.badRequestError(`Category "${category}" not found`)
        }
      }

      let effectiveVersionId = versionId
      if (!effectiveVersionId && docId) {
        const detailedObs = await project.observation.getByDocId(docId)
        if (!detailedObs) {
          throw errors.notFoundError(
            'Observation with provided docId not found',
          )
        }
        effectiveVersionId = detailedObs.versionId
      }

      // Fix for the docId type error by adding null check
      if (effectiveVersionId) {
        const body = /** @type {Record<string, any>} */ (req.body)

        // eslint-disable-next-line no-undefined
        if (docId === undefined) {
          throw errors.badRequestError('docId is required for updates')
        }

        // Explicitly reject lat/lon in updates
        if ('lat' in body || 'lon' in body) {
          throw errors.badRequestError(
            'Cannot update lat/lon of existing observation',
          )
        }

        // Retrieve the existing observation to merge tags/attachments
        const existingObs = await project.observation.getByDocId(docId)
        if (!existingObs) {
          throw errors.notFoundError(
            'Observation with provided docId not found',
          )
        }

        const mergedTags = {
          ...existingObs.tags, // keep current tags
          ...(preset ? preset.tags : {}), // preset tags if any
          ...(body.tags || {}), // override with provided tags
        }

        const mergedAttachments = [
          ...existingObs.attachments, // keep current attachments
          ...(body.attachments || []).map(
            (/** @type {Attachment} */ attachment) => ({
              ...attachment,
              hash: '',
            }),
          ),
        ]

        // Fix location overwrite issue in updates
        const updateData = {
          schemaName: /** @type {'observation'} */ ('observation'),
          // Keep original lat/lon values
          lat: existingObs.lat,
          lon: existingObs.lon,
          // Merge existing and new attachments
          attachments: mergedAttachments,
          // Merge existing and new tags
          tags: mergedTags,
          ...(preset && {
            presetRef: {
              docId: preset.docId,
              versionId: preset.versionId,
            },
          }),
        }

        return await project.observation.update(effectiveVersionId, updateData)
      }

      // Create new observation
      const body = /** @type {Record<string, any>} */ (req.body || {})
      if (typeof body.lat !== 'number' || typeof body.lon !== 'number') {
        throw errors.badRequestError(
          'lat and lon are required for new observations',
        )
      }

      // Fix for the attachment parameter typing
      const observationData = {
        schemaName: /** @type {'observation'} */ ('observation'),
        lat: body.lat,
        lon: body.lon,
        attachments: (body.attachments || []).map(
          (/** @type {Attachment} */ attachment) => ({
            ...attachment,
            hash: '',
          }),
        ),
        presetRef: preset
          ? { docId: preset.docId, versionId: preset.versionId }
          : void 0,
        tags: {
          ...(preset ? preset.tags : {}),
          ...(body.tags || {}),
        },
        metadata: body.metadata || {
          manualLocation: false,
          position: {
            mocked: false,
            timestamp: new Date().toISOString(),
            coords: {
              latitude: body.lat,
              longitude: body.lon,
            },
          },
        },
      }
      return await project.observation.create(observationData)
    },
  })
  fastify.delete('/projects/:projectPublicId/observations/:observationId', {
    schema: {
      params: Type.Object({
        projectPublicId: Type.String(),
        observationId: Type.String(),
      }),
      response: {
        200: Type.Any(),
        '4xx': schemas.errorResponse,
      },
    },
    preHandler: async (req, reply) => {
      const { projectPublicId } =
        /** @type {import('fastify').FastifyRequest<{ Params: { projectPublicId: string, observationId: string } }>} */ (
          req
        ).params
      try {
        await verifyProjectAuth(req, serverBearerToken, projectPublicId)
      } catch {
        reply.code(401)
        throw errors.invalidBearerToken()
      }
      await ensureProjectExists(
        fastify,
        /** @type {import('fastify').FastifyRequest<{ Params: { projectPublicId: string, observationId: string } }>} */ (
          req
        ),
      )
    },
    handler: async (req) => {
      const { projectPublicId, observationId } =
        /** @type {import('fastify').FastifyRequest<{ Params: { projectPublicId: string, observationId: string } }>} */ (
          req
        ).params
      const project = await fastify.comapeo.getProject(projectPublicId)
      return await project.observation.delete(observationId)
    },
  })
}
