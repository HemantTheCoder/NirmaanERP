-- =============================================================================
-- Nirmaan ERP — Migration 0034: Inventory & Equipment Tracking
-- =============================================================================

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE public.inventory_category AS ENUM ('material', 'consumable', 'tool');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_transaction_type AS ENUM (
    'receipt', 'issue', 'return', 'adjustment_increase', 'adjustment_decrease'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.equipment_status AS ENUM ('available', 'in_use', 'maintenance', 'retired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.inventory_category NOT NULL DEFAULT 'material',
  unit TEXT NOT NULL,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level NUMERIC NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost NUMERIC(12, 2),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_items IS 'Material/consumable/tool stock catalog. project_id NULL = central warehouse.';

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type public.inventory_transaction_type NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reference TEXT,
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_tag TEXT UNIQUE,
  category TEXT NOT NULL DEFAULT 'machinery',
  status public.equipment_status NOT NULL DEFAULT 'available',
  current_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  purchase_date DATE,
  last_maintenance_date DATE,
  next_maintenance_due DATE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL DEFAULT 'routine',
  cost NUMERIC(12, 2),
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Trigger: keep inventory_items.quantity_on_hand in sync with transactions
CREATE OR REPLACE FUNCTION public.apply_inventory_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory_items
  SET quantity_on_hand = quantity_on_hand + (
    CASE
      WHEN NEW.transaction_type IN ('receipt', 'return', 'adjustment_increase') THEN NEW.quantity
      ELSE -NEW.quantity
    END
  )
  WHERE id = NEW.inventory_item_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_inventory_transaction ON public.inventory_transactions;
CREATE TRIGGER trg_apply_inventory_transaction
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_transaction();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_project ON public.inventory_items(project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON public.inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assets_status ON public.equipment_assets(status);
CREATE INDEX IF NOT EXISTS idx_equipment_assets_project ON public.equipment_assets(current_project_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON public.equipment_maintenance_logs(equipment_id);

-- 5. Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;

CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "inventory_transactions_select" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_insert" ON public.inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_delete" ON public.inventory_transactions;

CREATE POLICY "inventory_transactions_select" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventory_transactions_insert" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
);

CREATE POLICY "inventory_transactions_delete" ON public.inventory_transactions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "equipment_assets_select" ON public.equipment_assets;
DROP POLICY IF EXISTS "equipment_assets_insert" ON public.equipment_assets;
DROP POLICY IF EXISTS "equipment_assets_update" ON public.equipment_assets;
DROP POLICY IF EXISTS "equipment_assets_delete" ON public.equipment_assets;

CREATE POLICY "equipment_assets_select" ON public.equipment_assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_assets_insert" ON public.equipment_assets FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "equipment_assets_update" ON public.equipment_assets FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "equipment_assets_delete" ON public.equipment_assets FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "equipment_maintenance_select" ON public.equipment_maintenance_logs;
DROP POLICY IF EXISTS "equipment_maintenance_insert" ON public.equipment_maintenance_logs;
DROP POLICY IF EXISTS "equipment_maintenance_delete" ON public.equipment_maintenance_logs;

CREATE POLICY "equipment_maintenance_select" ON public.equipment_maintenance_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_maintenance_insert" ON public.equipment_maintenance_logs FOR INSERT TO authenticated WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "equipment_maintenance_delete" ON public.equipment_maintenance_logs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
