-- =============================================================================
-- Nirmaan ERP — Seed Data (Migration 0003)
-- Seeds initial projects and tasks for demonstration and dashboard metrics.
-- =============================================================================

INSERT INTO public.projects (id, name, description, status, start_date, end_date)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Sunrise Residency – Tower A',
    'High-rise residential construction with 24 floors and premium amenities.',
    'active',
    '2026-01-15',
    '2026-10-31'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'NH-48 Bridge Widening',
    'Four-lane to six-lane highway bridge expansion over River Narmada.',
    'active',
    '2026-03-01',
    '2026-12-15'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Greenfield IT Park – Phase 2',
    'Commercial tech park construction including basement parking & glass facade.',
    'active',
    '2025-11-01',
    '2026-08-20'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Metro Station Fit-Out',
    'Interior finishes, MEP installations, and escalator fittings for Station 04.',
    'planning',
    '2026-06-01',
    '2027-02-28'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (id, title, description, status, priority, project_id, due_date)
VALUES
  -- Sunrise Residency Tasks
  (
    'a1111111-1111-1111-1111-111111111111',
    'Foundation Concrete Pouring - Block 1',
    'Pour C35 grade concrete for foundation raft.',
    'done',
    'high',
    '11111111-1111-1111-1111-111111111111',
    '2026-02-20'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'Column Reinforcement Inspection',
    'Quality check steel rebar placement for 5th to 8th floors.',
    'in_progress',
    'urgent',
    '11111111-1111-1111-1111-111111111111',
    '2026-08-05'
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'Plumbing & MEP Rough-in (Floors 1-4)',
    'Install core drainage pipes and conduit lines.',
    'todo',
    'medium',
    '11111111-1111-1111-1111-111111111111',
    '2026-08-25'
  ),

  -- NH-48 Bridge Tasks
  (
    'b1111111-1111-1111-1111-111111111111',
    'Pier Substructure Load Testing',
    'Perform hydraulic jack pressure test on Pier P3.',
    'in_progress',
    'urgent',
    '22222222-2222-2222-2222-222222222222',
    '2026-08-10'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'Girder Erection Segment 2',
    'Transport and position pre-stressed concrete girders.',
    'review',
    'high',
    '22222222-2222-2222-2222-222222222222',
    '2026-08-18'
  ),

  -- Greenfield IT Park Tasks
  (
    'c1111111-1111-1111-1111-111111111111',
    'Glass Curtain Wall Installation',
    'Fit double-glazed acoustic glass panels on East elevation.',
    'done',
    'high',
    '33333333-3333-3333-3333-333333333333',
    '2026-07-28'
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'HVAC Chiller Unit Commissioning',
    'Test central air conditioning chillers and duct airflow.',
    'done',
    'medium',
    '33333333-3333-3333-3333-333333333333',
    '2026-07-30'
  )
ON CONFLICT (id) DO NOTHING;
