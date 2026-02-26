import { supabaseAdmin } from '../clients/supabase'

/** Memoizes in-flight / completed bucket checks so Supabase is only queried once per bucket name per process. */
const bucketCheckCache = new Map<string, Promise<void>>()

export function ensureBucketExists(bucketName: string): Promise<void> {
  const cached = bucketCheckCache.get(bucketName)
  if (cached) return cached

  const promise = (async () => {
    try {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
      if (listError) {
        console.error(`Failed to list buckets when ensuring bucket ${bucketName} exists:`, listError)
        bucketCheckCache.delete(bucketName)
        return
      }

      if (buckets?.find((b) => b.name === bucketName)) {
        return
      }

      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      })

      if (createError) {
        console.error(`Failed to create bucket ${bucketName}:`, createError)
        bucketCheckCache.delete(bucketName)
      }
    } catch (error) {
      console.error(`Failed to ensure bucket ${bucketName} exists:`, error)
      bucketCheckCache.delete(bucketName)
    }
  })()

  bucketCheckCache.set(bucketName, promise)
  return promise
}
