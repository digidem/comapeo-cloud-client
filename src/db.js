import createFastifyPlugin from 'fastify-plugin'

import fs from 'node:fs'
import path from 'node:path'

const DB_FILE = 'users.json'

/**
 * @typedef {Object} Coordinator
 * @property {string} phoneNumber
 * @property {string} projectName
 * @property {string} [token]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} Member
 * @property {string} phoneNumber
 * @property {string} token
 * @property {string} coordinatorPhone
 * @property {string} projectName
 * @property {string} createdAt
 */

/**
 * @typedef {Object} DBMethods
 * @property {() => Coordinator[]} getCoordinators
 * @property {(coordinator: Coordinator) => void} saveCoordinator
 * @property {(phoneNumber: string) => Coordinator|null} findCoordinatorByPhone
 * @property {(phoneNumber: string) => string|null} findProjectByCoordinatorPhone
 * @property {() => Member[]} getMembers
 * @property {(member: Member) => void} saveMember
 * @property {(phoneNumber: string) => Member|null} findMemberByPhone
 */

/**
 * @typedef {Object} DBData
 * @property {Coordinator[]} coordinators
 * @property {Member[]} members
 */

/** @type {import('fastify').FastifyPluginAsync<{dbFolder: string}>} */
async function dbPlugin(fastify, { dbFolder }) {
  const dbPath = path.join(dbFolder, DB_FILE)

  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(
        dbPath,
        JSON.stringify({
          coordinators: [],
          members: [],
        }),
      )
    }
  } catch (err) {
    fastify.log.error('Failed to initialize database file:', err)
    throw err
  }

  /**
   * Read the current database state
   * @returns {DBData}
   */
  function readDb() {
    try {
      const data = fs.readFileSync(dbPath, 'utf8')
      return JSON.parse(data)
    } catch (err) {
      fastify.log.error('Failed to read database:', err)
      throw err
    }
  }

  /**
   * Write data to the database
   * @param {DBData} data
   */
  function writeDb(data) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
    } catch (err) {
      fastify.log.error('Failed to write to database:', err)
      throw err
    }
  }

  /** @type {DBMethods} */
  const db = {
    getCoordinators() {
      return readDb().coordinators
    },

    saveCoordinator(coordinator) {
      const data = readDb()
      const index = data.coordinators.findIndex(
        (c) => c.phoneNumber === coordinator.phoneNumber,
      )

      if (index >= 0) {
        data.coordinators[index] = coordinator
      } else {
        data.coordinators.push(coordinator)
      }

      writeDb(data)
    },

    findCoordinatorByPhone(phoneNumber) {
      const coordinator = readDb().coordinators.find(
        (c) => c.phoneNumber === phoneNumber,
      )
      return coordinator || null
    },

    findProjectByCoordinatorPhone(phoneNumber) {
      const coordinator = readDb().coordinators.find(
        (c) => c.phoneNumber === phoneNumber,
      )
      return coordinator ? coordinator.projectName : null
    },

    getMembers() {
      return readDb().members
    },

    saveMember(member) {
      const data = readDb()
      data.members.push(member)
      writeDb(data)
    },

    findMemberByPhone(phoneNumber) {
      const members = readDb().members
      const member = members.find((m) => m.phoneNumber === phoneNumber)
      return member || null
    },
  }

  fastify.decorate('db', db)

  fastify.addHook('onReady', async () => {
    if (!fastify.db) {
      throw new Error('db decoration missing')
    }
  })
}

/** @typedef {DBMethods} DB */
/** @typedef {DB} */

export default createFastifyPlugin(dbPlugin, {
  name: 'db',
  fastify: '4.x',
  decorators: {
    fastify: ['log'],
  },
})
