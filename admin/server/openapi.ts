import {
  apiV1ClipCreateBodySchema,
  apiV1ClipUpdateBodySchema,
  apiV1PostCreateBodySchema,
  apiV1PostListQuerySchema,
  apiV1PostUpdateBodySchema,
  clipListQuerySchema,
  imageListQuerySchema,
  slugParamsSchema,
} from './schemas';

const successObject = {
  description: 'Successful response.',
  content: {
    'application/json': {
      schema: { type: 'object', additionalProperties: true },
    },
  },
} as const;

const successList = {
  description: 'Successful paginated response.',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: true,
        required: ['items', 'total', 'page', 'pageSize'],
        properties: {
          items: { type: 'array', items: {} },
          total: { type: 'integer', minimum: 0 },
          page: { type: 'integer', minimum: 1 },
          pageSize: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
} as const;

const standardErrors = {
  400: { $ref: '#/components/responses/ApiError' },
  401: { $ref: '#/components/responses/ApiError' },
  403: { $ref: '#/components/responses/ApiError' },
  409: { $ref: '#/components/responses/ApiError' },
  413: { $ref: '#/components/responses/ApiError' },
  428: { $ref: '#/components/responses/ApiError' },
  429: { $ref: '#/components/responses/ApiError' },
} as const;

function queryParameters(schema: { properties: Record<string, unknown> }) {
  return Object.entries(schema.properties).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: false,
    schema: propertySchema,
  }));
}

const slugParameter = {
  name: 'slug',
  in: 'path',
  required: true,
  schema: slugParamsSchema.properties.slug,
} as const;

const ifMatchParameter = {
  name: 'If-Match',
  in: 'header',
  required: true,
  description: 'Current resource revision returned by the API.',
  schema: { type: 'string', minLength: 1 },
} as const;

export function createApiV1OpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Aier Blog AI API',
      version: '1.0.0',
      description: 'Scoped API for drafting and updating blog content. It cannot publish or delete content.',
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/posts': {
        get: {
          operationId: 'listPosts',
          summary: 'List posts',
          parameters: queryParameters(apiV1PostListQuerySchema),
          responses: { 200: successList, ...standardErrors },
        },
        post: {
          operationId: 'createPost',
          summary: 'Create a draft post',
          description: 'The server always forces draft=true and featured=false.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: apiV1PostCreateBodySchema } },
          },
          responses: { 201: successObject, ...standardErrors },
        },
      },
      '/api/v1/posts/{slug}': {
        get: {
          operationId: 'getPost',
          summary: 'Read a post',
          parameters: [slugParameter],
          responses: { 200: successObject, ...standardErrors },
        },
        put: {
          operationId: 'updatePost',
          summary: 'Update post content',
          description: 'Slug, draft and featured state cannot be changed through this API.',
          parameters: [slugParameter, ifMatchParameter],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: apiV1PostUpdateBodySchema } },
          },
          responses: { 200: successObject, ...standardErrors },
        },
      },
      '/api/v1/clips': {
        get: {
          operationId: 'listClips',
          summary: 'List code clips',
          parameters: queryParameters(clipListQuerySchema),
          responses: { 200: successList, ...standardErrors },
        },
        post: {
          operationId: 'createClip',
          summary: 'Create an independent code clip',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: apiV1ClipCreateBodySchema } },
          },
          responses: { 201: successObject, ...standardErrors },
        },
      },
      '/api/v1/clips/{slug}': {
        get: {
          operationId: 'getClip',
          summary: 'Read a code clip',
          parameters: [slugParameter],
          responses: { 200: successObject, ...standardErrors },
        },
        put: {
          operationId: 'updateClip',
          summary: 'Update a code clip',
          description: 'The clip slug and backing filename cannot be changed through this API.',
          parameters: [slugParameter, ifMatchParameter],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: apiV1ClipUpdateBodySchema } },
          },
          responses: { 200: successObject, ...standardErrors },
        },
      },
      '/api/v1/images': {
        get: {
          operationId: 'listImages',
          summary: 'List images',
          parameters: queryParameters(imageListQuerySchema),
          responses: { 200: successList, ...standardErrors },
        },
        post: {
          operationId: 'uploadImage',
          summary: 'Upload an image',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: { 201: successObject, ...standardErrors },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          operationId: 'getOpenApiDocument',
          summary: 'Read this OpenAPI document',
          responses: { 200: successObject, ...standardErrors },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'aier_pat',
        },
      },
      responses: {
        ApiError: {
          description: 'API error response.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                required: ['code', 'message', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  details: {},
                  requestId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}
