// For TypeScript type checking in JavaScript files
export interface EncryptionKeys {
  auth: string
  config: string
  data: string
  blobIndex: string
  blob: string
}

export interface ProjectToAdd {
  projectName: string
  projectKey?: string
  encryptionKeys?: EncryptionKeys
}
