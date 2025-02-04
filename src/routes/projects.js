// @ts-check
import { keyToPublicId as projectKeyToPublicId } from '@mapeo/crypto'
import { Type } from '@sinclair/typebox'
// @ts-ignore
import QRCode from 'qrcode'
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
/** @typedef {import('fastify').FastifyRequest<{Params: {projectPublicId: string}, Querystring: {qr?: boolean, projectId?: string, name?: string}}>} ProjectRequest */
/** @typedef {import('../types/project.js').ProjectToAdd} ProjectToAdd */

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
        querystring: Type.Object({
          qr: Type.Optional(Type.Boolean({ default: false })),
          projectId: Type.Optional(Type.String()),
          name: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                projectId: Type.String(),
                name: Type.Optional(Type.String()),
                qrCode: Type.Optional(Type.String()),
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
    async (req) => {
      const projects = await fastify.comapeo.listProjects()
      let filteredProjects = projects

      const query =
        /** @type {import('fastify').FastifyRequest<{Querystring: {qr?: boolean, projectId?: string, name?: string}}>} */ (
          req
        ).query

      if (query.projectId) {
        filteredProjects = projects.filter(
          (p) => p.projectId === query.projectId,
        )
      } else if (query.name) {
        console.log(`Filtering projects by name: ${query.name}`)
        filteredProjects = projects.filter((p) => p.name === query.name)
        console.log(
          `Found ${filteredProjects.length} projects matching name "${query.name}"`,
        )
      }
      const projectData = await Promise.all(
        filteredProjects.map(async (p) => {
          /** @type {{projectId: string, name?: string, qrCode?: string}} */
          const data = { projectId: p.projectId, name: p.name }
          if (query.qr) {
            data.qrCode = await QRCode.toDataURL(p.projectId)
          }
          return data
        }),
      )
      return { data: projectData }
    },
  )
  // GET /projects/:projectId/settings
  fastify.get(
    '/projects/:projectId/settings',
    {
      schema: {
        params: Type.Object({
          projectId: Type.String(),
        }),
        response: {
          200: Type.Object({
            data: Type.Object({
              name: Type.Optional(Type.String()),
              presets: Type.Array(Type.Any()),
            }),
          }),
          404: schemas.errorResponse,
        },
      },
      async preHandler(req) {
        verifyBearerAuth(req, serverBearerToken)
      },
    },
    async (req) => {
      const { projectId } =
        /** @type {import('fastify').FastifyRequest<{Params: {projectId: string}}>} */ (
          req
        ).params
      const project = await fastify.comapeo.getProject(projectId)
      if (!project) {
        throw errors.projectNotFoundError()
      }
      const settings = await project.$getProjectSettings()
      if (Object.keys(settings).length === 0) {
        return {
          data: {
            presets: [],
          },
        }
      }
      const presets = await project.preset.getMany()
      const fields = await project.field.getMany()

      // Create a map of field docIds to field objects for quick lookup
      const fieldMap = new Map(fields.map((field) => [field.docId, field]))

      // Transform presets to include linked fields directly
      const presetsWithFields = presets.map((preset) => {
        // Get the full field objects for each fieldRef
        const linkedFields = preset.fieldRefs
          .map((ref) => fieldMap.get(ref.docId))
          .filter(Boolean) // Remove any undefined fields

        // Return preset with fields array instead of fieldRefs
        const { fieldRefs: _fieldRefs, ...presetWithoutRefs } = preset
        return {
          ...presetWithoutRefs,
          fields: linkedFields,
        }
      })

      return {
        data: {
          ...settings,
          presets: presetsWithFields,
        },
      }
    },
  )

  // PUT /projects
  fastify.put(
    '/projects',
    {
      schema: {
        querystring: Type.Object({
          qr: Type.Optional(Type.Boolean({ default: false })),
        }),
        body: schemas.projectToAdd,
        response: {
          200: Type.Object({
            data: Type.Object({
              deviceId: schemas.HEX_STRING_32_BYTES,
              projectId: schemas.HEX_STRING_32_BYTES,
              qrCode: Type.Optional(Type.String()),
            }),
          }),
          400: schemas.errorResponse,
        },
      },
    },
    async (req) => {
      const body = /** @type {ProjectToAdd} */ (req.body)
      const query =
        /** @type {import('fastify').FastifyRequest<{Querystring: {qr?: boolean}}>} */ (
          req
        ).query

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
      /** @type {{data: {deviceId: string, projectId: string, qrCode?: string}}} */
      const response = {
        data: {
          deviceId: fastify.comapeo.deviceId,
          projectId: projectPublicId,
        },
      }
      if (query.qr) {
        response.data.qrCode = await QRCode.toDataURL(projectPublicId)
      }
      return response
    },
  )
}
