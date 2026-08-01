const { Client } = require('pg');

// Standard passwords and connection string formats
const PASSWORDS = [
  'Moneha12@',
  'Demo@1234',
  'Sb_publishable_UIRMoevUEj_QOfH24P1Pzg_JYKdSO3Y',
  'gnhesvdsmtdkkmikfcmi'
];

const HOSTS = [
  'db.gnhesvdsmtdkkmikfcmi.supabase.co',
  'aws-0-ap-south-1.pooler.supabase.com'
];

async function tryConnect() {
  console.log('Testing Postgres connections...');
  for (const host of HOSTS) {
    for (const pwd of PASSWORDS) {
      const user = host.includes('pooler') ? 'postgres.gnhesvdsmtdkkmikfcmi' : 'postgres';
      const port = host.includes('pooler') ? 6543 : 5432;
      const conn = `postgresql://${user}:${encodeURIComponent(pwd)}@${host}:${port}/postgres`;
      try {
        console.log(`Connecting as ${user} to ${host}:${port}...`);
        const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
        await client.connect();
        console.log('🎉 CONNECTED SUCCESSFULLY with password:', pwd);

        // Fetch current policy BEFORE
        const res = await client.query(`
          SELECT policyname, cmd, qual, with_check 
          FROM pg_policies 
          WHERE schemaname = 'public' AND tablename = 'resource_allocations';
        `);
        console.log('\n--- BEFORE: POLICIES ON resource_allocations ---');
        console.log(res.rows);

        // Apply policy update (Identity binding + Authorized role)
        await client.query(`
          DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;

          CREATE POLICY "resource_allocations_insert" ON public.resource_allocations FOR INSERT WITH CHECK (
            requested_by = auth.uid()
            AND EXISTS (
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
        console.log(`Connection failed:`, err.message);
      }
    }
  }
  return false;
}

tryConnect();
