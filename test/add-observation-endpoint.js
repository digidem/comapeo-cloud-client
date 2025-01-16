import { keyToPublicId as projectKeyToPublicId } from '@mapeo/crypto'

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BEARER_TOKEN,
  createTestServer,
  randomAddProjectBody,
  randomProjectPublicId,
} from './test-helpers.js'

test('adding an observation', async (t) => {
  const server = createTestServer(t)
  const projectBody = randomAddProjectBody()
  const projectPublicId = projectKeyToPublicId(
    Buffer.from(projectBody.projectKey, 'hex'),
  )

  // First create a project
  const addProjectResponse = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: projectBody,
  })
  assert.equal(addProjectResponse.statusCode, 200)

  // Generate mock observation data
  const observationData = {
    lat: 51.5074,
    lon: -0.1278,
    tags: {
      notes: 'Test observation',
    },
    attachments: [],
  }

  // Add observation to project
  const response = await server.inject({
    method: 'PUT',
    url: `/projects/${projectPublicId}/observation`,
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
    },
    body: observationData,
  })

  assert.equal(response.statusCode, 201)
})

test('returns 401 if no auth provided', async (t) => {
  const server = createTestServer(t)
  const projectId = randomProjectPublicId()

  const response = await server.inject({
    method: 'PUT',
    url: `/projects/${projectId}/observation`,
    body: {
      lat: 51.5074,
      lon: -0.1278,
    },
  })

  assert.equal(response.statusCode, 401)
  assert.equal(response.json().error.code, 'UNAUTHORIZED')
})

test('returns 404 if project does not exist', async (t) => {
  const server = createTestServer(t)
  const projectId = randomProjectPublicId()

  const response = await server.inject({
    method: 'PUT',
    url: `/projects/${projectId}/observation`,
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
    },
    body: {
      lat: 51.5074,
      lon: -0.1278,
    },
  })

  assert.equal(response.statusCode, 404)
  assert.equal(response.json().error.code, 'PROJECT_NOT_FOUND')
})
