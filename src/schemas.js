import { Type } from '@sinclair/typebox'

import { BASE32_STRING_32_BYTES } from './routes/constants.js'

// -----------------------------------------------------------------
// Constants & Base Types
// -----------------------------------------------------------------
const HEX_REGEX_32_BYTES = '^[0-9a-fA-F]{64}$'
export const HEX_STRING_32_BYTES = Type.String({ pattern: HEX_REGEX_32_BYTES })

const dateTimeString = Type.String({ format: 'date-time' })
const latitude = Type.Number({ minimum: -90, maximum: 90 })
const longitude = Type.Number({ minimum: -180, maximum: 180 })

// -----------------------------------------------------------------
// Error Schema
// -----------------------------------------------------------------
export const errorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
})

// -----------------------------------------------------------------
// Project Schemas
// -----------------------------------------------------------------
export const projectToAdd = Type.Object({
  projectName: Type.String({ minLength: 1 }),
  projectKey: Type.Optional(HEX_STRING_32_BYTES),
  encryptionKeys: Type.Optional(
    Type.Object({
      auth: HEX_STRING_32_BYTES,
      config: HEX_STRING_32_BYTES,
      data: HEX_STRING_32_BYTES,
      blobIndex: HEX_STRING_32_BYTES,
      blob: HEX_STRING_32_BYTES,
    }),
  ),
})
/** @typedef {import('./types/project.js').ProjectToAdd} ProjectToAdd */

// -----------------------------------------------------------------
// Attachment Schemas
// -----------------------------------------------------------------
export const attachmentSchema = Type.Object({
  driveDiscoveryId: Type.String(),
  type: Type.Union([Type.Literal('photo'), Type.Literal('audio')]),
  name: Type.String(),
  hash: Type.Optional(Type.String()),
})
/** @typedef {import('@sinclair/typebox').Static<typeof observationToAdd>} ObservationToAdd */
/** @typedef {{driveDiscoveryId: string, type: 'photo'|'audio', name: string, hash?: string}} Attachment */

export const attachmentParams = Type.Object({
  projectPublicId: BASE32_STRING_32_BYTES,
  driveDiscoveryId: Type.String(),
  type: Type.Union([Type.Literal('photo'), Type.Literal('audio')]),
  name: Type.String(),
})
/** @typedef {import('@sinclair/typebox').Static<typeof attachmentQuerystring>} AttachmentQuerystring */
export const attachmentQuerystring = Type.Object({
  variant: Type.Optional(
    Type.Union([
      Type.Literal('original'),
      Type.Literal('preview'),
      Type.Literal('thumbnail'),
    ]),
  ),
})

// -----------------------------------------------------------------
// Observation Schemas
// -----------------------------------------------------------------
export const observationToAdd = Type.Object({
  lat: Type.Number(),
  lon: Type.Number(),
  attachments: Type.Optional(
    Type.Array(
      Type.Object({
        driveDiscoveryId: Type.String(),
        type: Type.Union([Type.Literal('photo'), Type.Literal('audio')]),
        name: Type.String(),
      }),
    ),
  ),
  tags: Type.Optional(Type.Record(Type.String(), Type.String())),
  metadata: Type.Optional(Type.Object({})),
})

export const observationToUpdate = Type.Object({
  attachments: Type.Optional(
    Type.Array(
      Type.Object({
        driveDiscoveryId: Type.String(),
        type: Type.Union([Type.Literal('photo'), Type.Literal('audio')]),
        name: Type.String(),
      }),
    ),
  ),
  tags: Type.Optional(Type.Record(Type.String(), Type.String())),
})

export const observationResult = Type.Object({
  docId: Type.String(),
  createdAt: dateTimeString,
  updatedAt: dateTimeString,
  deleted: Type.Boolean(),
  lat: Type.Optional(latitude),
  lon: Type.Optional(longitude),
  attachments: Type.Array(
    Type.Object({
      url: Type.String(),
    }),
  ),
  tags: Type.Record(
    Type.String(),
    Type.Union([
      Type.Boolean(),
      Type.Number(),
      Type.String(),
      Type.Null(),
      Type.Array(
        Type.Union([Type.Boolean(), Type.Number(), Type.String(), Type.Null()]),
      ),
    ]),
  ),
})

// -----------------------------------------------------------------
// Remote Detection Alert Schemas
// -----------------------------------------------------------------
const position = Type.Tuple([longitude, latitude])

const remoteDetectionAlertCommon = {
  detectionDateStart: dateTimeString,
  detectionDateEnd: dateTimeString,
  sourceId: Type.String({ minLength: 1 }),
  metadata: Type.Record(
    Type.String(),
    Type.Union([
      Type.Boolean(),
      Type.Number(),
      Type.String(),
      Type.Null(),
      Type.Array(
        Type.Union([Type.Boolean(), Type.Number(), Type.String(), Type.Null()]),
      ),
    ]),
  ),
  geometry: Type.Union([
    Type.Object({
      type: Type.Literal('Point'),
      coordinates: position,
    }),
    Type.Object({
      type: Type.Literal('LineString'),
      coordinates: Type.Array(position, { minItems: 2 }),
    }),
    Type.Object({
      type: Type.Literal('MultiLineString'),
      coordinates: Type.Array(Type.Array(position, { minItems: 2 })),
    }),
    Type.Object({
      type: Type.Literal('Polygon'),
      coordinates: Type.Array(Type.Array(position, { minItems: 4 })),
    }),
    Type.Object({
      type: Type.Literal('MultiPoint'),
      coordinates: Type.Array(position),
    }),
    Type.Object({
      type: Type.Literal('MultiPolygon'),
      coordinates: Type.Array(
        Type.Array(Type.Array(position, { minItems: 4 })),
      ),
    }),
  ]),
}

export const remoteDetectionAlertToAdd = Type.Object({
  ...remoteDetectionAlertCommon,
})

export const remoteDetectionAlertResult = Type.Object({
  docId: Type.String(),
  createdAt: dateTimeString,
  updatedAt: dateTimeString,
  deleted: Type.Boolean(),
  ...remoteDetectionAlertCommon,
})
