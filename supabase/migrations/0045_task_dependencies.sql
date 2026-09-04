-- Real Gantt dependencies: a task can be blocked by one or more other
-- tasks (finish-to-start). Many-to-many join table since a task can have
-- multiple predecessors (e.g. "Plinth Beam" depends on both "Foundation"
-- and a delivery task).

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (task_id <> depends_on_task_id),
  UNIQUE (task_id, depends_on_task_id)
);

COMMENT ON TABLE public.task_dependencies IS
  'Finish-to-start predecessor links: task_id is blocked until depends_on_task_id completes.';

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on_id ON public.task_dependencies(depends_on_task_id);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_dependencies_select" ON public.task_dependencies;
CREATE POLICY "task_dependencies_select" ON public.task_dependencies FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "task_dependencies_insert" ON public.task_dependencies;
CREATE POLICY "task_dependencies_insert" ON public.task_dependencies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND assignee_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

DROP POLICY IF EXISTS "task_dependencies_delete" ON public.task_dependencies;
CREATE POLICY "task_dependencies_delete" ON public.task_dependencies FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tasks WHERE id = task_id AND assignee_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- Cycles (A depends on B depends on C depends on A) can't be prevented by
-- any FK/CHECK constraint — enforced here as a server-side backstop that
-- can't be bypassed by any client. The primary UX guard is a client-side
-- reachability check before ever attempting the insert (see
-- lib/utils/criticalPath.ts); this trigger is what makes that guarantee
-- actually hold regardless of what any future client does.
CREATE OR REPLACE FUNCTION public.check_task_dependency_acyclic()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE reachable AS (
      SELECT depends_on_task_id AS id FROM public.task_dependencies WHERE task_id = NEW.depends_on_task_id
      UNION
      SELECT td.depends_on_task_id FROM public.task_dependencies td
        JOIN reachable r ON td.task_id = r.id
    )
    SELECT 1 FROM reachable WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Cannot add dependency: would create a cycle (% already depends transitively on %)', NEW.depends_on_task_id, NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_dependencies_acyclic ON public.task_dependencies;
CREATE TRIGGER trg_task_dependencies_acyclic
  BEFORE INSERT ON public.task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.check_task_dependency_acyclic();

NOTIFY pgrst, 'reload schema';
