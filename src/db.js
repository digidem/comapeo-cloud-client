import createFastifyPlugin from 'fastify-plugin'

import fs from 'node:fs'
import path from 'node:path'

import { BEARER_SPACE_LENGTH } from './routes/utils.js'

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
 * @typedef {Object} MagicLink
 * @property {string} token
 * @property {boolean} used
 * @property {string} createdAt
 * @property {string} userToken
 */

/**
 * @typedef {Object} DBMethods
 * @property {() => Coordinator[]} getCoordinators
 * @property {(coordinator: Coordinator) => void} saveCoordinator
 * @property {(phoneNumber: string) => void} deleteCoordinatorByPhone
 * @property {(phoneNumber: string) => Coordinator|null} findCoordinatorByPhone
 * @property {(phoneNumber: string) => string|null} findProjectByCoordinatorPhone
 * @property {(projectName: string) => Coordinator|null} findCoordinatorByProject
 * @property {() => Member[]} getMembers
 * @property {(member: Member) => void} saveMember
 * @property {(phoneNumber: string) => Member|null} findMemberByPhone
 * @property {(token: string) => (Coordinator|Member|null)} getUserByToken
 * @property {(userToken: string, magicLinkToken: string) => void} addMagicLinkToken
 * @property {(magicLinkToken: string) => { user: (Coordinator|Member), magicLink: MagicLink } | null} getMagicLinkToken
 * @property {(userToken: string) => MagicLink[]} getUserMagicLinks
 * @property {(magicLinkToken: string) => void} invalidateMagicLink
 */

/**
 * Extracts the actual token from a bearer token string.
 * @param {string} t - The bearer token string.
 * @returns {string} The token without the 'Bearer ' prefix.
 */
export function getToken(t) {
  if (!t) return ''
  if (!t.includes('Bearer')) return t
  return t.slice(BEARER_SPACE_LENGTH)
}

/**
 * @typedef {Object} DBData
 * @property {Coordinator[]} coordinators
 * @property {Member[]} members
 * @property {MagicLink[]} [magicLinks]
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

    deleteCoordinatorByPhone(phoneNumber) {
      const data = readDb()
      data.coordinators = data.coordinators.filter(
        (c) => c.phoneNumber !== phoneNumber,
      )
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

    findCoordinatorByProject(projectName) {
      const coordinator = readDb().coordinators.find(
        (c) => c.projectName === projectName,
      )
      return coordinator || null
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

    /**
     * Retrieve a user (either coordinator or member) by their token.
     * @param {string} token - The token to search for.
     * @returns {(Coordinator|Member|null)} The user object if found, otherwise null.
     */
    getUserByToken(token) {
      fastify.log.info(`getUserByToken called with token: ${token}`)
      const data = readDb()
      // Look for user in coordinators
      const parsedToken = getToken(token)
      fastify.log.info(`Parsed token: ${parsedToken}`)
      const coordinator = data.coordinators.find((c) => c.token === parsedToken)
      if (coordinator) {
        fastify.log.info(`Found coordinator: ${JSON.stringify(coordinator)}`)
        return coordinator
      }
      // Look for user in members
      const member = data.members.find((m) => m.token === parsedToken)
      if (member) {
        fastify.log.info(`Found member: ${JSON.stringify(member)}`)
      } else {
        fastify.log.info('No user found')
      }
      return member || null
    },

    /**
     * Adds a magic link token for a specific user.
     * The token is stored in the global magicLinks array as an object:
     * { token: string, used: boolean, createdAt: string, userToken: string }
     *
     * @param {string} userToken - The token associated with the user.
     * @param {string} magicLinkToken - The magic link token to add.
     */
    addMagicLinkToken(userToken, magicLinkToken) {
      const data = readDb()
      if (!data.magicLinks) {
        data.magicLinks = []
      }
      const magicLinkEntry = {
        token: magicLinkToken,
        used: false,
        createdAt: new Date().toISOString(),
        userToken,
      }
      data.magicLinks.push(magicLinkEntry)
      writeDb(data)
    },

    /**
     * Retrieves the magic link token information together with the associated user.
     *
     * @param {string} magicLinkToken - The magic link token to search for.
     * @returns {{
     *   user: (Coordinator|Member),
     *   magicLink: MagicLink
     * } | null} An object containing the user info and magicLink details if found; otherwise, null.
     */
    getMagicLinkToken(magicLinkToken) {
      fastify.log.info(
        `getMagicLinkToken called with magicLinkToken: ${magicLinkToken}`,
      )
      const data = readDb()
      if (!data.magicLinks) {
        fastify.log.info('No magicLinks array found in the database')
        return null
      }
      const magicLinkEntry = data.magicLinks.find((entry) => {
        const isMatch = entry.token === magicLinkToken
        fastify.log.info(
          `Checking magic link entry: token=${entry.token}, expected=${magicLinkToken}, isMatch=${isMatch}`,
        )
        return isMatch
      })
      if (!magicLinkEntry) {
        fastify.log.info(
          `No magic link entry found for token: ${magicLinkToken}`,
        )
        return null
      }
      fastify.log.info(
        `Magic link entry found: ${JSON.stringify(magicLinkEntry)}`,
      )
      const user = this.getUserByToken(magicLinkEntry.userToken)
      if (!user) {
        fastify.log.info(
          `No associated user found for magic link with userToken: ${magicLinkEntry.userToken}`,
        )
        return null
      }
      fastify.log.info(
        `Associated user found for magic link: ${JSON.stringify(user)}`,
      )
      return { user, magicLink: magicLinkEntry }
    },

    /**
     * Retrieves all magic links created by a specific user.
     *
     * @param {string} userToken - The token associated with the user.
     * @returns {MagicLink[]} An array of magic links created by the user.
     */
    getUserMagicLinks(userToken) {
      const data = readDb()
      if (!data.magicLinks) {
        return []
      }
      return data.magicLinks.filter((link) => link.userToken === userToken)
    },

    /**
     * Marks a magic link token as used.
     *
     * @param {string} magicLinkToken - The magic link token to invalidate.
     */
    invalidateMagicLink(magicLinkToken) {
      const data = readDb()
      if (!data.magicLinks) {
        return
      }
      const magicLinkEntry = data.magicLinks.find(
        (entry) => entry.token === magicLinkToken,
      )
      if (magicLinkEntry) {
        magicLinkEntry.used = true
        writeDb(data)
      }
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
