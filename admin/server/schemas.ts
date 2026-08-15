import type { FastifySchema } from 'fastify';

const datePattern = '^\\d{4}-\\d{2}-\\d{2}$';
const slugPattern = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
const positiveIntegerPattern = '^[1-9]\\d*$';

export const openObjectSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export const openArraySchema = {
  type: 'array',
  items: {},
} as const;

export const slugParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug'],
  properties: {
    slug: { type: 'string', minLength: 1, maxLength: 160 },
  },
} as const;

export const idParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[A-Za-z0-9._-]+$', maxLength: 200 },
  },
} as const;

export const jobIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['jobId'],
  properties: {
    jobId: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const postClipParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postSlug', 'clipSlug'],
  properties: {
    postSlug: { type: 'string', minLength: 1, maxLength: 160 },
    clipSlug: { type: 'string', minLength: 1, maxLength: 160 },
  },
} as const;

export const postParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postSlug'],
  properties: {
    postSlug: { type: 'string', minLength: 1, maxLength: 160 },
  },
} as const;

export const postHistoryParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'revisionNumber'],
  properties: {
    slug: { type: 'string', minLength: 1, maxLength: 160 },
    revisionNumber: { type: 'string', pattern: positiveIntegerPattern },
  },
} as const;

export const postListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', maxLength: 200 },
    status: { type: 'string', enum: ['draft', 'published'] },
    page: { type: 'string', pattern: positiveIntegerPattern },
    includeDeleted: { type: 'string', enum: ['true', 'false'] },
  },
} as const;

export const apiV1PostListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', maxLength: 200 },
    status: { type: 'string', enum: ['draft', 'published'] },
    page: { type: 'string', pattern: positiveIntegerPattern },
  },
} as const;
export const clipListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', maxLength: 200 },
    language: { type: 'string', maxLength: 100 },
    page: { type: 'string', pattern: positiveIntegerPattern },
  },
} as const;

export const imageListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', maxLength: 200 },
    referencedBy: { type: 'string', maxLength: 160 },
    owner: { type: 'string', maxLength: 160 },
    page: { type: 'string', pattern: positiveIntegerPattern },
  },
} as const;

export const logListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    level: { type: 'string', enum: ['info', 'warn', 'error'] },
    scope: { type: 'string', maxLength: 200 },
    page: { type: 'string', pattern: positiveIntegerPattern },
  },
} as const;

const postFrontmatterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'publishedAt', 'tags', 'draft', 'featured'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 300 },
    description: { type: 'string', maxLength: 2_000 },
    publishedAt: { type: 'string', pattern: datePattern },
    updatedAt: { type: 'string', pattern: datePattern },
    tags: {
      type: 'array',
      maxItems: 100,
      items: { type: 'string', minLength: 1, maxLength: 100 },
    },
    draft: { type: 'boolean' },
    featured: { type: 'boolean' },
    cover: { type: 'string', maxLength: 500 },
  },
} as const;

export const editorPostBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['body'],
  anyOf: [
    { required: ['slug', 'frontmatter'] },
    { required: ['title', 'description', 'publishedAt', 'tags', 'draft', 'featured'] },
  ],
  properties: {
    slug: { type: 'string', pattern: slugPattern, maxLength: 160 },
    frontmatter: postFrontmatterSchema,
    title: postFrontmatterSchema.properties.title,
    description: postFrontmatterSchema.properties.description,
    publishedAt: postFrontmatterSchema.properties.publishedAt,
    updatedAt: postFrontmatterSchema.properties.updatedAt,
    tags: postFrontmatterSchema.properties.tags,
    draft: postFrontmatterSchema.properties.draft,
    featured: postFrontmatterSchema.properties.featured,
    cover: postFrontmatterSchema.properties.cover,
    body: { type: 'string' },
    expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const optionalRevisionBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const postSlugMigrationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['newSlug'],
  properties: {
    newSlug: { type: 'string', pattern: slugPattern, maxLength: 160 },
    expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const editorClipBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'language', 'file', 'createdAt', 'code'],
  properties: {
    slug: { type: 'string', pattern: slugPattern, maxLength: 160 },
    title: { type: 'string', minLength: 1, maxLength: 300 },
    description: { type: 'string', maxLength: 2_000 },
    language: { type: 'string', minLength: 1, maxLength: 100 },
    file: { type: 'string', minLength: 1, maxLength: 255 },
    createdAt: { type: 'string', pattern: datePattern },
    updatedAt: { type: 'string', pattern: datePattern },
    code: { type: 'string' },
    ownerPostSlug: { type: 'string', maxLength: 160 },
    expectedPostRevision: { type: 'string', minLength: 1, maxLength: 200 },
    expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const attachClipBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['clipSlug', 'expectedPostRevision'],
  properties: {
    clipSlug: { type: 'string', minLength: 1, maxLength: 160 },
    expectedPostRevision: { type: 'string', minLength: 1, maxLength: 200 },
    insertOffset: { type: 'integer', minimum: 0 },
  },
} as const;

export const removeClipBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['expectedPostRevision'],
  properties: {
    expectedPostRevision: { type: 'string', minLength: 1, maxLength: 200 },
    trashSource: { type: 'boolean' },
  },
} as const;

export const clipSlugMigrationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['newFile'],
  properties: {
    newFile: { type: 'string', minLength: 1, maxLength: 255 },
    expectedRevision: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const backupApplyBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;


export const setupBeginBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    token: { type: 'string', minLength: 1, maxLength: 500 },
    username: { type: 'string', minLength: 1, maxLength: 100 },
    password: { type: 'string', minLength: 1, maxLength: 1_000 },
  },
} as const;

export const setupConfirmBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    challenge: { type: 'string', minLength: 1, maxLength: 500 },
    totpCode: { type: 'string', minLength: 1, maxLength: 20 },
  },
} as const;

export const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 100 },
    password: { type: 'string', minLength: 1, maxLength: 1_000 },
    totp: { type: 'string', minLength: 1, maxLength: 20 },
    recoveryCode: { type: 'string', minLength: 1, maxLength: 200 },
    secondFactor: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['totp', 'recovery-code'] },
        code: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
} as const;

export const rotateSecurityBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    currentPassword: { type: 'string', minLength: 1, maxLength: 1_000 },
    newPassword: { type: 'string', minLength: 1, maxLength: 1_000 },
    username: { type: 'string', minLength: 1, maxLength: 100 },
    totp: { type: 'string', minLength: 1, maxLength: 20 },
    recoveryCode: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;


export const apiTokenCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'scopes'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    scopes: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: {
        type: 'string',
        enum: [
          'posts:read',
          'posts:write',
          'clips:read',
          'clips:write',
          'images:read',
          'images:write',
        ],
      },
    },
    expiresInDays: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
  },
} as const;


const apiV1PostProperties = {
  slug: { type: 'string', pattern: slugPattern, maxLength: 160 },
  title: { type: 'string', minLength: 1, maxLength: 300 },
  description: { type: 'string', maxLength: 2_000 },
  publishedAt: { type: 'string', pattern: datePattern },
  updatedAt: { type: 'string', pattern: datePattern },
  tags: {
    type: 'array',
    maxItems: 100,
    items: { type: 'string', minLength: 1, maxLength: 100 },
  },
  draft: { type: 'boolean' },
  featured: { type: 'boolean' },
  cover: { type: 'string', maxLength: 500 },
  body: { type: 'string' },
} as const;

export const apiV1PostCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'description', 'publishedAt', 'tags', 'body'],
  properties: apiV1PostProperties,
} as const;

export const apiV1PostUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'publishedAt', 'tags', 'body'],
  properties: apiV1PostProperties,
} as const;


const apiV1ClipProperties = {
  slug: { type: 'string', pattern: slugPattern, maxLength: 160 },
  title: { type: 'string', minLength: 1, maxLength: 300 },
  description: { type: 'string', maxLength: 2_000 },
  language: { type: 'string', minLength: 1, maxLength: 100 },
  file: { type: 'string', minLength: 1, maxLength: 255 },
  createdAt: { type: 'string', pattern: datePattern },
  updatedAt: { type: 'string', pattern: datePattern },
  code: { type: 'string' },
} as const;

export const apiV1ClipCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'language', 'file', 'createdAt', 'code'],
  properties: apiV1ClipProperties,
} as const;

export const apiV1ClipUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'language', 'file', 'createdAt', 'code'],
  properties: apiV1ClipProperties,
} as const;

export function jsonSchema(options: Omit<FastifySchema, 'response'> & {
  response?: 'object' | 'array';
} = {}): FastifySchema {
  const response = options.response === 'array'
    ? openArraySchema
    : openObjectSchema;
  return {
    ...options,
    response: {
      200: response,
      201: response,
      202: response,
    },
  };
}
