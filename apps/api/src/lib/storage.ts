import { supabaseAdmin } from '../clients/supabase'

export async function ensureBucketExists(bucketName: string) {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    if (listError) {
      console.error(`Failed to list buckets when ensuring bucket ${bucketName} exists:`, listError)
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
      return
    }
  } catch (error) {
    console.error(`Failed to ensure bucket ${bucketName} exists:`, error)
  }
}
