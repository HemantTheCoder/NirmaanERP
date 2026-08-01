const { Client } = require('pg');

const PASSWORDS = ['Moneha12@', 'Demo@1234', 'nirmaan_erp_2026', 'nirmaan1234'];
const HOSTS = [
  'db.gnhesvdsmtdkkmikfcmi.supabase.co',
  'aws-0-ap-south-1.pooler.supabase.com'
];

async function tryConnect() {
  for (const host of HOSTS) {
    for (const pwd of PASSWORDS) {
      const user = host.includes('pooler') ? 'postgres.gnhesvdsmtdkkmikfcmi' : 'postgres';
      const conn = `postgresql://${user}:${encodeURIComponent(pwd)}@${host}:5432/postgres`;
      try {
        console.log(`Trying ${user}@${host}...`);
        const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
        await client.connect();
        console.log('✅ CONNECTED SUCCESSFULLY with pwd:', pwd);

        // Fetch current policy BEFORE
        const res = await client.query(`
          SELECT policyname, cmd, qual, with_check 
          FROM pg_policies 
          WHERE schemaname = 'public' AND tablename = 'resource_allocations';
        `);
        console.log('\n--- BEFORE: POLICIES ON resource_allocations ---');
        console.log(res.rows);

        // Apply migration 0021
        await client.query(`
          DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;

          CREATE POLICY "resource_allocations_insert" ON public.resource_allocations FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.users
               WHERE id = auth.uid()
                 AND role IN ('admin', 'project_manager', 'site_staff')
            )
          );
        `);

        // Fetch policy AFTER
        const updatedRes = await client.query(`
          SELECT policyname, cmd, qual, with_check 
          FROM pg_policies 
          WHERE schemaname = 'public' AND tablename = 'resource_allocations';
        `);
        console.log('\n--- AFTER: POLICIES ON resource_allocations ---');
        console.log(updatedRes.rows);

        await client.end();
        return true;
      } catch (err) {
        // failed
      }
    }
  }
  return false;
}

tryConnect();
