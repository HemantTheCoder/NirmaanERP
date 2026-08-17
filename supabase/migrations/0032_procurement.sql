-- =============================================================================
-- Nirmaan ERP — Migration 0032: Procurement (Vendors & Purchase Orders)
-- =============================================================================
-- `vendors` is shared with the subcontractor management module (0033):
-- vendor_type distinguishes material suppliers from subcontractors.

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE public.vendor_type AS ENUM ('supplier', 'subcontractor', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vendor_status AS ENUM ('active', 'inactive', 'blacklisted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM (
    'draft', 'pending_approval', 'approved', 'rejected',
    'ordered', 'partially_received', 'received', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vendor_type public.vendor_type NOT NULL DEFAULT 'supplier',
  status public.vendor_status NOT NULL DEFAULT 'active',
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  gst_number TEXT,
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendors IS 'Material suppliers and subcontractors — shared master data for procurement and subcontractor management.';

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_seq INTEGER GENERATED ALWAYS AS IDENTITY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  status public.po_status NOT NULL DEFAULT 'draft',
  expected_delivery_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_orders IS 'Purchase orders issued to vendors for project materials.';

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_type ON public.vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON public.purchase_order_items(po_id);

-- 4. Row Level Security
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_select" ON public.vendors;
DROP POLICY IF EXISTS "vendors_insert" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update" ON public.vendors;
DROP POLICY IF EXISTS "vendors_delete" ON public.vendors;

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "purchase_orders_select" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete" ON public.purchase_orders;

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "purchase_order_items_select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_update" ON public.purchase_order_items;
DROP POLICY IF EXISTS "purchase_order_items_delete" ON public.purchase_order_items;

CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
