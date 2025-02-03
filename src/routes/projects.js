// @ts-check
import { keyToPublicId as projectKeyToPublicId } from '@mapeo/crypto'
import { Type } from '@sinclair/typebox'
import timingSafeEqual from 'string-timing-safe-equal'

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

import * as errors from '../errors.js'
import * as schemas from '../schemas.js'
import { verifyBearerAuth } from './utils.js'

/** @typedef {import('fastify').FastifyInstance} FastifyInstance */
/** @typedef {import('fastify').FastifyPluginAsync} FastifyPluginAsync */
/** @typedef {import('fastify').FastifyRequest} FastifyRequest */
/** @typedef {import('fastify').RawServerDefault} RawServerDefault */
/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}}>} ProjectRequest */

/**
 * @typedef {object} RouteOptions
 * @prop {string} serverBearerToken
 * @prop {string} serverName
 * @prop {undefined | number | string[]} [allowedProjects=1]
 */

/** @type {import('fastify').FastifyPluginAsync<RouteOptions>} */
export default async function projectsRoutes(fastify, opts) {
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
      async preHandler(req) {
        verifyBearerAuth(req, serverBearerToken)
      },
    },
    async () => {
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
      async preHandler(req) {
        verifyBearerAuth(req, serverBearerToken)
      },
    },
    async (req) => {
      const body = /** @type {import('../schemas.js').ProjectToAdd} */ (
        req.body
      )
      const projectKey = body.projectKey
        ? Buffer.from(body.projectKey, 'hex')
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
        const encryptionKeys = body.encryptionKeys || {
          auth: randomBytes(32).toString('hex'),
          config: randomBytes(32).toString('hex'),
          data: randomBytes(32).toString('hex'),
          blobIndex: randomBytes(32).toString('hex'),
          blob: randomBytes(32).toString('hex'),
        }
        const projectId = await fastify.comapeo.addProject(
          {
            projectKey,
            projectName: body.projectName,
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
}
