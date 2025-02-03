// @ts-check
import { keyToPublicId as projectKeyToPublicId } from '@mapeo/crypto'
import { Type } from '@sinclair/typebox'
import fp from 'fastify-plugin'
import timingSafeEqual from 'string-timing-safe-equal'

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { SUPPORTED_ATTACHMENT_TYPES } from './constants.js'
import { ensureProjectExists, verifyBearerAuth } from './utils.js'

/**
 * Plugin options.
 * @typedef {Object} ProjectsPluginOptions
 * @property {string} [serverBearerToken]
 * @property {string} [serverName]
 * @property {number|string[]} [allowedProjects]
 */

/**
 * Handles /projects endpoints:
 * - GET /projects
 * - PUT /projects
 * - GET /projects/:projectPublicId/attachments/:driveDiscoveryId/:type/:name
 *
 * @param {import('fastify').FastifyInstance} fastify Fastify instance.
 * @param {ProjectsPluginOptions} opts Plugin options.
 */
async function projectsRoutes(fastify, opts) {
  const { serverBearerToken, serverName, allowedProjects = 1 } = opts
  const allowedProjectsSetOrNumber = Array.isArray(allowedProjects)
    ? new Set(allowedProjects)
    : allowedProjects

  // GET /projects
  fastify.get(
    '/projects',
    {
      schema: {
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                projectId: Type.String(),
                name: Type.Optional(Type.String()),
              }),
            ),
          }),
          '4xx': schemas.errorResponse,
        },
      },
      preHandler: (req, _reply, done) => {
        verifyBearerAuth(req, serverBearerToken)
        done()
      },
    },
    /**
     * @param {import('fastify').FastifyRequest} _req
     * @param {import('fastify').FastifyReply} _reply
     */
    async function handler(_req, _reply) {
      const projects = await fastify.comapeo.listProjects()
      return {
        data: projects.map((p) => ({ projectId: p.projectId, name: p.name })),
      }
    },
  )

  // PUT /projects
  fastify.put(
    '/projects',
    {
      schema: {
        body: schemas.projectToAdd,
        response: {
          200: Type.Object({
            data: Type.Object({
              deviceId: schemas.HEX_STRING_32_BYTES,
              projectId: schemas.HEX_STRING_32_BYTES,
            }),
          }),
          400: schemas.errorResponse,
        },
      },
      preHandler: (req, _reply, done) => {
        verifyBearerAuth(req, serverBearerToken)
        done()
      },
    },
    /**
     * @param {import('fastify').FastifyRequest} req
     * @param {import('fastify').FastifyReply} _reply
     */
    async function handler(req, _reply) {
      const projectKey = req.body.projectKey
        ? Buffer.from(req.body.projectKey, 'hex')
        : randomBytes(32)
      const projectPublicId = projectKeyToPublicId(projectKey)
      const existingProjects = await fastify.comapeo.listProjects()

      const alreadyHasThisProject = existingProjects.some((p) =>
        timingSafeEqual(p.projectId, projectPublicId),
      )
      if (!alreadyHasThisProject) {
        if (
          allowedProjectsSetOrNumber instanceof Set &&
          !allowedProjectsSetOrNumber.has(projectPublicId)
        ) {
          throw errors.projectNotInAllowlist()
        }
        if (
          typeof allowedProjectsSetOrNumber === 'number' &&
          existingProjects.length >= allowedProjectsSetOrNumber
        ) {
          throw errors.tooManyProjects()
        }
      }
      const baseUrl = req.baseUrl.toString()
      const existingDeviceInfo = fastify.comapeo.getDeviceInfo()
      if (
        existingDeviceInfo.deviceType === 'device_type_unspecified' ||
        existingDeviceInfo.selfHostedServerDetails?.baseUrl !== baseUrl
      ) {
        await fastify.comapeo.setDeviceInfo({
          deviceType: 'selfHostedServer',
          name: serverName,
          selfHostedServerDetails: { baseUrl },
        })
      }
      if (!alreadyHasThisProject) {
        const encryptionKeys = req.body.encryptionKeys || {
          auth: randomBytes(32).toString('hex'),
          config: randomBytes(32).toString('hex'),
          data: randomBytes(32).toString('hex'),
          blobIndex: randomBytes(32).toString('hex'),
          blob: randomBytes(32).toString('hex'),
        }
        const projectId = await fastify.comapeo.addProject(
          {
            projectKey,
            projectName: req.body.projectName,
            encryptionKeys: {
              auth: Buffer.from(encryptionKeys.auth, 'hex'),
              config: Buffer.from(encryptionKeys.config, 'hex'),
              data: Buffer.from(encryptionKeys.data, 'hex'),
              blobIndex: Buffer.from(encryptionKeys.blobIndex, 'hex'),
              blob: Buffer.from(encryptionKeys.blob, 'hex'),
            },
          },
          { waitForSync: false },
        )
        assert.equal(
          projectId,
          projectPublicId,
          'adding a project should return the same ID as what was passed',
        )
      }
      const project = await fastify.comapeo.getProject(projectPublicId)
      project.$sync.start()
      return {
        data: {
          deviceId: fastify.comapeo.deviceId,
          projectId: projectPublicId,
        },
      }
    },
  )

  // GET attachments
  fastify.get(
    '/projects/:projectPublicId/attachments/:driveDiscoveryId/:type/:name',
    {
      schema: {
        params: Type.Object({
          projectPublicId: schemas.HEX_STRING_32_BYTES,
          driveDiscoveryId: Type.String(),
          type: Type.Union(
            [...SUPPORTED_ATTACHMENT_TYPES].map((attachmentType) =>
              Type.Literal(attachmentType),
            ),
          ),
          name: Type.String(),
        }),
        querystring: Type.Object({
          variant: Type.Optional(
            Type.Union([
              Type.Literal('original'),
              Type.Literal('preview'),
              Type.Literal('thumbnail'),
            ]),
          ),
        }),
        response: {
          200: {},
          '4xx': schemas.errorResponse,
        },
      },
      preHandler: async (req) => {
        verifyBearerAuth(req, serverBearerToken)
        await ensureProjectExists(fastify, req)
      },
    },
    /**
     * @param {import('fastify').FastifyRequest} req
     * @param {import('fastify').FastifyReply} reply
     */
    async function handler(req, reply) {
      const project = await fastify.comapeo.getProject(
        req.params.projectPublicId,
      )
      let typeAndVariant
      switch (req.params.type) {
        case 'photo':
          typeAndVariant = {
            type: 'photo',
            variant: req.query.variant || 'original',
          }
          break
        case 'audio':
          if (req.query.variant && req.query.variant !== 'original') {
            throw errors.badRequestError(
              'Cannot fetch this variant for audio attachments',
            )
          }
          typeAndVariant = { type: 'audio', variant: 'original' }
          break
        default:
          throw errors.shouldBeImpossibleError(req.params.type)
      }
      const blobId = {
        driveId: req.params.driveDiscoveryId,
        name: req.params.name,
        ...typeAndVariant,
      }
      const blobUrl = await project.$blobs.getUrl(blobId)
      const proxiedResponse = await fetch(blobUrl)
      reply.code(proxiedResponse.status)
      for (const [headerName, headerValue] of proxiedResponse.headers) {
        reply.header(headerName, headerValue)
      }
      return reply.send(proxiedResponse.body)
    },
  )
}

export default fp(projectsRoutes, { name: 'projectsRoutes' })
