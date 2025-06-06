import cors from '@fastify/cors'
import { Type } from '@sinclair/typebox'
import envSchema from 'env-schema'
import createFastify from 'fastify'

import crypto from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

import comapeoServer from './app.js'

const DEFAULT_STORAGE = path.join(process.cwd(), 'data')
const CORE_DIR_NAME = 'core'
const DB_DIR_NAME = 'db'
const ROOT_KEY_FILE_NAME = 'root-key'

const schema = Type.Object({
  PORT: Type.Number({ default: 8080 }),
  SERVER_NAME: Type.String({
    description: 'name of the server',
    default: 'CoMapeo Server',
  }),
  SERVER_BEARER_TOKEN: Type.String({
    description:
      'Bearer token for accessing the server, can be any random string',
  }),
  STORAGE_DIR: Type.String({
    description: 'path to directory where data is stored',
    default: DEFAULT_STORAGE,
  }),
  ALLOWED_PROJECTS: Type.Optional(
    Type.Integer({
      minimum: 1,
      description: 'number of projects allowed to join the server',
    }),
  ),
})

/** @typedef {import('@sinclair/typebox').Static<typeof schema>} Env */
/** @type {ReturnType<typeof envSchema<Env>>} */
const config = envSchema({ schema, dotenv: true })

const coreStorage = path.join(config.STORAGE_DIR, CORE_DIR_NAME)
const dbFolder = path.join(config.STORAGE_DIR, DB_DIR_NAME)
const rootKeyFile = path.join(config.STORAGE_DIR, ROOT_KEY_FILE_NAME)

const migrationsFolder = new URL(
  '../node_modules/@comapeo/core/drizzle/',
  import.meta.url,
).pathname
const projectMigrationsFolder = path.join(migrationsFolder, 'project')
const clientMigrationsFolder = path.join(migrationsFolder, 'client')

await Promise.all([
  fsPromises.mkdir(coreStorage, { recursive: true }),
  fsPromises.mkdir(dbFolder, { recursive: true }),
])

/** @type {Buffer} */
let rootKey
try {
  rootKey = await fsPromises.readFile(rootKeyFile)
} catch (err) {
  if (
    typeof err === 'object' &&
    err &&
    'code' in err &&
    err.code !== 'ENOENT'
  ) {
    throw err
  }
  rootKey = crypto.randomBytes(16)
  await fsPromises.writeFile(rootKeyFile, rootKey)
}

if (!rootKey || rootKey.length !== 16) {
  throw new Error('Root key must be 16 bytes')
}

const fastify = createFastify({
  logger: true,
  trustProxy: true,
})

await fastify.register(cors, {
  // put your options here
})

// Register Swagger
// @ts-ignore
await fastify.register(import('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'Mapeo Cloud API',
      description: 'API documentation for Mapeo Cloud Server',
      version: '1.0.0',
    },
    servers: [
      {
        url: '{protocol}://{hostname}:{port}',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http',
          },
          hostname: {
            default: 'localhost',
          },
          port: {
            default: config.PORT.toString(),
          },
        },
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter the token with the `Bearer: ` prefix, e.g. "Bearer abcde12345"',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
})

// @ts-ignore
await fastify.register(import('@fastify/swagger-ui'), {
  routePrefix: '/docs',
})

fastify.register(comapeoServer, {
  serverName: config.SERVER_NAME,
  serverBearerToken: config.SERVER_BEARER_TOKEN,
  allowedProjects: config.ALLOWED_PROJECTS,
  rootKey,
  coreStorage,
  dbFolder,
  defaultStorage: DEFAULT_STORAGE,
  projectMigrationsFolder,
  clientMigrationsFolder,
})

fastify.get(
  '/healthcheck',
  {
    schema: {
      description: 'Healthcheck endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  },
  async () => ({ status: 'ok' }),
)

try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

/** @param {NodeJS.Signals} signal*/
async function closeGracefully(signal) {
  console.log(`Received signal to terminate: ${signal}`)
  await fastify.close()
  console.log('Gracefully closed fastify')
  process.kill(process.pid, signal)
}
process.once('SIGINT', closeGracefully)
process.once('SIGTERM', closeGracefully)
