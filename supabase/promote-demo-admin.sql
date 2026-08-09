-- Run only after creating the disposable demo admin in Supabase Authentication.
-- Replace the reserved example address with the exact demo address used there.
update public.profiles
set role = 'admin', full_name = 'Aatish Demo Admin'
where id = (
  select id from auth.users where lower(email) = lower('demo.admin@aatish-aangan.example')
);

update public.profiles
set full_name = 'Strict Customer Tester'
where id = (
  select id from auth.users where lower(email) = lower('test.customer@aatish-aangan.example')
);

-- Verification: this must return exactly one admin profile.
select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
