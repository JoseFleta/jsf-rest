# Supabase Setup (Multi-Tenant)

Apply the migration in `supabase/migrations/20260209224000_multi_tenant_core.sql` to create:

- `organizations`
- `organization_memberships`
- `restaurants`
- `user_preferences`
- RLS policies for tenant isolation

## 1) Run migration

Use Supabase SQL Editor and execute the migration file.

## 2) Configure Auth redirect URLs

In Supabase Dashboard:

- `Authentication` -> `URL Configuration`
- Add your local app URL (for example `http://localhost:3000`)
- Add callback URL: `http://localhost:3000/auth/callback`

## 3) Bootstrap first tenant

After creating your first auth user and signing in at `/auth/login`, the app auto-provisions:

- one default organization
- one default restaurant (`Main Location`)
- active tenant values in `user_preferences`

The `on_organization_created` trigger still adds the creator as `owner` in `organization_memberships`.
