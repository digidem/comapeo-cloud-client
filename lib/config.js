import * as dirname from 'desm'
import envSchema from 'env-schema'
import * as fs from 'fs/promises'

export const schema = {
	type: 'object',
	required: [
		'MAPEO_PROJECT_PUBLIC_KEY',
		'MAPEO_IDENTITY_KEYPAIR_FILEPATH'
	],
	properties: {
		MAPEO_PROJECT_PUBLIC_KEY: {
			type: 'string'
		},
		MAPEO_IDENTITY_KEYPAIR_FILEPATH: {
			type: 'string'
		},
		MAPEO_DATA_DIRECTORY: {
			type: 'string',
			default: '.data'
		}
	}
}

export async function validate ({ dotenvFilepath, schema }) {
	const config = envSchema({
		schema,
		dotenv: {
			path: dotenvFilepath
		}
	})
	

	const keyPairErrorMessage =
	`mapeo keyPair not found at MAPEO_IDENTITY_KEYPAIR_FILEPATH: ${config.MAPEO_IDENTITY_KEYPAIR_FILEPATH}
Expected file with JSON object with publicKey and secretKey properties
`

if (!(await exists(config.MAPEO_IDENTITY_KEYPAIR_FILEPATH))) {
	throw new Error(keyPairErrorMessage)
}

const keyPairJson = await fs.readFile(config.MAPEO_IDENTITY_KEYPAIR_FILEPATH, 'utf8')

if (!keyPairJson) {
	throw new Error(keyPairErrorMessage)
}

const keyPair = JSON.parse(keyPairJson)

if (!keyPair.publicKey || !keyPair.secretKey) {
	throw new Error(keyPairErrorMessage)
}

return {
	projectPublicKey: config.MAPEO_PROJECT_PUBLIC_KEY,
	keyPair,
	dataDirectory: dirname.join(import.meta.url, '..', config.MAPEO_DATA_DIRECTORY)
}

}

async function exists (filepath) {
	try {
		await fs.stat(filepath)
		return true
	} catch (error) {
		if (error.code === 'ENOENT') {
			return false
		}
		throw error
	}
}
