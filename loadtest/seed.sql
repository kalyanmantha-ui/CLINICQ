-- Load-test data: 1 doctor, 50 open slots, 1000 patients (all with password Load#Test1).
create extension if not exists pgcrypto;
insert into users(email,password_hash,full_name,role)
  values ('doctor@load.test', crypt('Load#Test1', gen_salt('bf',4)), 'Load Doctor', 'DOCTOR');
insert into doctors(user_id,specialty) select id,'GP' from users where email='doctor@load.test';
insert into slots(doctor_id,start_at,end_at)
  select u.id, now() + (g || ' hours')::interval + interval '1 day', now() + (g || ' hours')::interval + interval '1 day 30 minutes'
  from users u, generate_series(1,50) g where u.email='doctor@load.test';
insert into users(email,password_hash,full_name,role)
  select 'p' || lpad(g::text,4,'0') || '@load.test', crypt('Load#Test1', gen_salt('bf',4)), 'Load Patient ' || g, 'PATIENT'
  from generate_series(0,999) g;
insert into patients(user_id) select id from users where role='PATIENT';
