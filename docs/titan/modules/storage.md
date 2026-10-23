---
title: titan-storage
description: Local and S3 object storage behind one streaming adapter contract.
---

# titan-storage

`@omnitron-dev/titan-storage` provides `StorageAdapter`, `LocalAdapter`,
`S3Adapter`, `StorageModule` and the `STORAGE_ADAPTER` injection token.
It owns object bytes and adapter lifecycle. Account records, authorization,
tenants, quotas, sharing links and application metadata remain application code.

```ts
import { StorageModule } from '@omnitron-dev/titan-storage';

const storage = StorageModule.forRoot({ backend: 'local' });
// Include `storage` in the application's module imports.
```

The module registers one selected adapter using Titan's config and logger
dependencies. The package currently includes the S3 SDK dependencies; choosing
the local backend avoids initializing an S3 client, but does not remove those
packages from installation. Both adapters implement the same server-side
streaming interface; this is not a browser upload client.

## Configuration and lifecycle

| Backend | Configuration |
| --- | --- |
| Local | `storage.local.basePath`; defaults to `./data/storage` |
| S3 | `storage.s3`: `bucket`, `accessKeyId`, `secretAccessKey`; optional `endpoint`, `region`, `forcePathStyle`, `maxSockets`, `connectionTimeout`, `socketTimeout` |

If `storage.s3` is absent, S3 reads `S3_ENDPOINT`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY` and `S3_BUCKET` from the environment. Supply credentials through
runtime configuration. Local initialization creates the base directory. S3
initialization creates its client; teardown destroys it. Lifecycle ownership
belongs to Titan when the adapter is registered as a module provider. A caller
constructing an adapter directly must invoke its lifecycle itself.

## Operations

| Surface | Methods |
| --- | --- |
| Object bytes and metadata | `put`, `get`, `head`, `exists` |
| Listing and copying | `list`, `copy` |
| Removal | `delete`, `deleteMany` with per-key failures |
| Temporary delivery | `getSignedUrl` |
| Multipart uploads | `createMultipartUpload`, `uploadPart`, `listParts`, `completeMultipartUpload`, `abortMultipartUpload` |
| Usage | `getStorageInfo` |

`put` accepts a Node `Readable` or `Buffer` and `PutOptions`; `get` returns a
stream with content metadata and supports byte ranges and conditional reads.
`list` uses continuation tokens and can group prefixes. Copy and upload results
carry an ETag and may carry a backend version ID. Do not infer versioning from
an optional result field.

Use `listParts` to obtain the backend's authoritative part numbers and ETags
before completing a multipart upload. Local multipart bookkeeping is in memory
and is lost on process restart; use a durable backend when that constraint is
unacceptable. The local adapter's signed URL behavior also needs an application
HTTP delivery route. S3 usage reporting is cached; it is not an atomic quota gate.

## Application boundary

Resolve a permitted object key before calling the adapter. Enforce resource
ownership, access policy, upload limits and transactional metadata changes in
application services. Never derive authorization merely from a successful
storage operation. Partial deletion errors must remain visible to cleanup jobs.

See [composition boundaries](../../foundations/composition.md),
[shared access policy](../../auth/access-policy.md) and the
[API index](../../reference/api-index.mdx) for the full exported types.
