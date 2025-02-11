import { keyToPublicId as projectKeyToPublicId } from '@mapeo/crypto'

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTestServer,
  omit,
  randomAddProjectBody,
  randomHex,
} from './test-helpers.js'

test('request missing project name', async (t) => {
  const server = createTestServer(t)

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: omit(randomAddProjectBody(), 'projectName'),
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'BAD_REQUEST')
})

test('request with empty project name', async (t) => {
  const server = createTestServer(t)

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: { ...randomAddProjectBody(), projectName: '' },
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'BAD_REQUEST')
})

test("request with a project key that's too short", async (t) => {
  const server = createTestServer(t)

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: { ...randomAddProjectBody(), projectKey: randomHex(31) },
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'BAD_REQUEST')
})

test('request missing an encryption key', async (t) => {
  const server = createTestServer(t)
  const body = randomAddProjectBody()

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: {
      ...body,
      encryptionKeys: omit(body.encryptionKeys, 'config'),
    },
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'BAD_REQUEST')
})

test("request with an encryption key that's too short", async (t) => {
  const server = createTestServer(t)
  const body = randomAddProjectBody()

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: {
      ...body,
      encryptionKeys: { ...body.encryptionKeys, config: randomHex(31) },
    },
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json().error.code, 'BAD_REQUEST')
})

test('adding a project', async (t) => {
  const server = createTestServer(t)

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: randomAddProjectBody(),
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    data: {
      deviceId: server.deviceId,
      projectId: response.json().data.projectId,
      projectName: response.json().data.projectName,
    },
  })
})

test('adding a second project fails by default', async (t) => {
  const server = createTestServer(t)

  const firstAddResponse = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: randomAddProjectBody(),
  })
  assert.equal(firstAddResponse.statusCode, 200)

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: randomAddProjectBody(),
  })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().error.code, 'TOO_MANY_PROJECTS')
  assert.match(response.json().error.message, /maximum number of projects/u)
})

test('allowing a maximum number of projects', async (t) => {
  const server = createTestServer(t, { allowedProjects: 3 })

  await t.test('adding 3 projects', async () => {
    for (let i = 0; i < 3; i++) {
      const response = await server.inject({
        method: 'PUT',
        url: '/projects',
        body: randomAddProjectBody(),
      })
      assert.equal(response.statusCode, 200)
    }
  })

  await t.test('attempting to add 4th project fails', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/projects',
      body: randomAddProjectBody(),
    })
    assert.equal(response.statusCode, 403)
    assert.equal(response.json().error.code, 'TOO_MANY_PROJECTS')
    assert.match(response.json().error.message, /maximum number of projects/u)
  })
})

test(
  'allowing a specific list of projects',
  { concurrency: true },
  async (t) => {
    const body = randomAddProjectBody()
    const projectPublicId = projectKeyToPublicId(
      Buffer.from(body.projectKey, 'hex'),
    )
    const server = createTestServer(t, {
      allowedProjects: [projectPublicId],
    })

    await t.test('adding a project in the list', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/projects',
        body,
      })
      assert.equal(response.statusCode, 200)
    })

    await t.test('trying to add a project not in the list', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/projects',
        body: randomAddProjectBody(),
      })
      assert.equal(response.statusCode, 403)
      assert.equal(response.json().error.code, 'PROJECT_NOT_IN_ALLOWLIST')
    })
  },
)

test('adding the same project twice is idempotent', async (t) => {
  const server = createTestServer(t, { allowedProjects: 1 })
  const body = randomAddProjectBody()

  const firstResponse = await server.inject({
    method: 'PUT',
    url: '/projects',
    body,
  })
  assert.equal(firstResponse.statusCode, 200)

  const secondResponse = await server.inject({
    method: 'PUT',
    url: '/projects',
    body,
  })
  assert.equal(secondResponse.statusCode, 200)
})

test('adding a project with only projectName generates random keys', async (t) => {
  const server = createTestServer(t)
  const projectName = 'Test Project'

  const response = await server.inject({
    method: 'PUT',
    url: '/projects',
    body: { projectName },
  })

  assert.equal(response.statusCode, 200)
  const { data } = response.json()
  assert.ok(data.deviceId, 'Response includes deviceId')
  assert.ok(data.projectId, 'Response includes generated projectId')
})
