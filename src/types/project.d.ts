// For TypeScript type checking in JavaScript files
export interface EncryptionKeys {
  /** 32-byte hex string */
  auth: string
  /** 32-byte hex string */
  config: string
  /** 32-byte hex string */
  data: string
  /** 32-byte hex string */
  blobIndex: string
  /** 32-byte hex string */
  blob: string
}

export interface ProjectToAdd {
  /** Project name, must be at least 1 character */
  projectName: string
  /** Optional 32-byte hex string */
  projectKey?: string
  /** Optional encryption keys */
  encryptionKeys?: EncryptionKeys
}
