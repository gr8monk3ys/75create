// Account deletion (Supabase Edge Function, Deno runtime).
//
// The app can delete a user's rows and storage objects with their own
// credentials, but not the auth.users record itself — that needs the service
// role. Without this function "delete my account" only ever deleted the data,
// leaving the account able to sign in again to an empty challenge.
//
// Deploy with JWT verification ON (the default): the caller must present their
// own access token, and this deletes that user and nobody else. There is no
// user id in the request body by design.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Missing authorization' }, 401)

  // Identify the caller with their own token — never a user id from the body.
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )
  const { data, error } = await caller.auth.getUser()
  if (error || !data.user) return json({ error: 'Invalid session' }, 401)
  const userId = data.user.id

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Storage objects aren't removed by the cascade, so clear them first.
  const { data: files } = await admin.storage.from('artifacts').list(userId)
  if (files && files.length > 0) {
    await admin.storage.from('artifacts').remove(files.map((f) => `${userId}/${f.name}`))
  }

  // Every table references auth.users with on delete cascade, so deleting the
  // auth user removes profile, challenges, day data and push subscriptions.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ deleted: true }, 200)
})
