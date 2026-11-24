import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const required = ['ERP_DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD'];
for (const name of required) if (!process.env[name]) throw new Error(name + ' is required.');
if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 16) throw new Error('Use a 16+ character bootstrap password.');
const email = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
const sql = postgres(process.env.ERP_DATABASE_URL, { max: 1, connect_timeout: 15 });
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('digitalsquare-first-admin'))`;
    const administrators = await transaction`
      SELECT e.id FROM public.employees e
      JOIN public.user_roles ur ON ur.user_id=e.id
      JOIN public.roles r ON r.id=ur.role_id
      WHERE e.user_status='ACTIVE' AND r.code='ADMIN' AND r.active LIMIT 1`;
    if (administrators.length) { console.log('Existing administrator retained.'); return; }

    const existing = await transaction`SELECT id,user_status FROM public.employees WHERE lower(email)=${email}`;
    if (existing[0] && !['REQUESTED', 'ACTIVE'].includes(existing[0].user_status)) throw new Error('This identity cannot be used for initial setup.');
    let id = existing[0]?.id;
    if (!id) {
      const { data, error } = await auth.auth.admin.createUser({ email, password: process.env.BOOTSTRAP_ADMIN_PASSWORD, email_confirm: true, user_metadata: { name: 'Administrator' } });
      if (error || !data.user) throw new Error('Administrator identity creation failed.');
      id = data.user.id;
    }
    let companies = await transaction`SELECT id FROM public.organizations WHERE organization_type='COMPANY' AND active ORDER BY created_at LIMIT 1`;
    if (!companies.length) companies = await transaction`INSERT INTO public.organizations(name,organization_type) VALUES (${process.env.BOOTSTRAP_COMPANY_NAME || '디지털스퀘어'},'COMPANY') RETURNING id`;
    await transaction`UPDATE public.employees SET employee_number=COALESCE(employee_number,'DS-ADMIN-001'),join_date=COALESCE(join_date,(now() AT TIME ZONE 'Asia/Seoul')::date),organization_id=COALESCE(organization_id,${companies[0].id}),user_status='ACTIVE' WHERE id=${id}`;
    const roles = await transaction`INSERT INTO public.user_roles(user_id,role_id) SELECT ${id},id FROM public.roles WHERE code IN ('ADMIN','MEMBER','EMPLOYEE') AND active ON CONFLICT DO NOTHING RETURNING role_id`;
    const requiredRoles = await transaction`SELECT count(*)::int AS count FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=${id} AND r.code IN ('ADMIN','MEMBER','EMPLOYEE') AND r.active`;
    if (requiredRoles[0].count !== 3) throw new Error('Initial administrator roles are incomplete.');
    console.log('Initial administrator prepared; role assignments: ' + roles.length);
  });
} finally {
  await sql.end();
}
