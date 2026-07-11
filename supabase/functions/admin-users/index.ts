import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Identify the caller from their login token, and make sure they're an admin.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'Missing auth token' }, 401)

    const { data: callerData, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !callerData?.user) return json({ error: 'Invalid session' }, 401)

    const { data: callerProfile, error: profileErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerData.user.id)
      .single()

    if (profileErr || callerProfile?.role !== 'admin') {
      return json({ error: 'Superadmins only' }, 403)
    }

    const body = await req.json()
    const { action } = body

    // ---- List every team member, with their limit and active/deactivated status ----
    if (action === 'list') {
      const [profilesResult, limitsResult, authUsersResult] = await Promise.all([
        admin.from('profiles').select('id, name, email, role, created_at').order('created_at', { ascending: true }),
        admin.from('supervisor_limits').select('*'),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ])

      const { data: profiles, error } = profilesResult
      if (error) return json({ error: error.message }, 400)

      const { data: limits } = limitsResult
      const { data: authUsersPage } = authUsersResult

      const merged = (profiles ?? []).map((p) => {
        const limit = limits?.find((l) => l.user_id === p.id)
        const authUser = authUsersPage?.users.find((u) => u.id === p.id)
        const bannedUntil = authUser?.banned_until ? new Date(authUser.banned_until) : null
        return {
          ...p,
          approval_limit: limit?.approval_limit ?? null,
          currency: limit?.currency ?? null,
          active: !bannedUntil || bannedUntil.getTime() < Date.now(),
        }
      })
      return json({ data: merged })
    }

    // ---- Create a new team member ----
    if (action === 'create') {
      const { name, email, password, role, approval_limit } = body
      if (!name || !email || !password || !role) {
        return json({ error: 'name, email, password, and role are required' }, 400)
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? 'Could not create user' }, 400)
      }

      const newId = created.user.id

      const { error: updateErr } = await admin.from('profiles').update({ name, role }).eq('id', newId)
      if (updateErr) return json({ error: updateErr.message }, 400)

      if (role === 'supervisor' && approval_limit) {
        const { error: limitErr } = await admin
          .from('supervisor_limits')
          .upsert({ user_id: newId, approval_limit, currency: 'INR' })
        if (limitErr) return json({ error: limitErr.message }, 400)
      }

      return json({ data: { id: newId } })
    }

    // ---- Edit an existing member's name / role / approval limit ----
    if (action === 'update') {
      const { user_id, name, role, approval_limit } = body
      if (!user_id || !role) return json({ error: 'user_id and role are required' }, 400)

      const { error: updateErr } = await admin
        .from('profiles')
        .update({ role, ...(name ? { name } : {}) })
        .eq('id', user_id)
      if (updateErr) return json({ error: updateErr.message }, 400)

      if (role === 'supervisor') {
        const { error: limitErr } = await admin
          .from('supervisor_limits')
          .upsert({ user_id, approval_limit: approval_limit ?? 0, currency: 'INR' })
        if (limitErr) return json({ error: limitErr.message }, 400)
      } else {
        await admin.from('supervisor_limits').delete().eq('user_id', user_id)
      }

      return json({ data: { ok: true } })
    }

    // ---- Reset a member's password ----
    if (action === 'set_password') {
      const { user_id, password } = body
      if (!user_id || !password) return json({ error: 'user_id and password are required' }, 400)
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)

      const { error } = await admin.auth.admin.updateUserById(user_id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ data: { ok: true } })
    }

    // ---- Deactivate / reactivate a member (blocks login without deleting their data) ----
    if (action === 'set_active') {
      const { user_id, active } = body
      if (!user_id || typeof active !== 'boolean') {
        return json({ error: 'user_id and active are required' }, 400)
      }
      const { data: targetProfile } = await admin.from('profiles').select('role').eq('id', user_id).single()
      if (targetProfile?.role === 'admin') {
        return json({ error: 'Superadmins cannot be deactivated' }, 400)
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: active ? 'none' : '876000h',
      })
      if (error) return json({ error: error.message }, 400)
      return json({ data: { ok: true } })
    }

    // ---- Permanently remove a member ----
    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'user_id is required' }, 400)
      if (user_id === callerData.user.id) {
        return json({ error: 'You cannot delete your own account' }, 400)
      }
      const { data: targetProfile } = await admin.from('profiles').select('role').eq('id', user_id).single()
      if (targetProfile?.role === 'admin') {
        return json({ error: 'Superadmins cannot be removed' }, 400)
      }
      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message }, 400)
      return json({ data: { ok: true } })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
