-- Restrict RLS policies to authenticated users only to remove public exposure.
-- Drop existing permissive policies
DROP POLICY IF EXISTS "public access customers" ON public.customers;
DROP POLICY IF EXISTS "public access inv_mov" ON public.inventory_movements;
DROP POLICY IF EXISTS "public access payables" ON public.payables;
DROP POLICY IF EXISTS "public access payments" ON public.payments;
DROP POLICY IF EXISTS "public access products" ON public.products;
DROP POLICY IF EXISTS "public access sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "public access sales" ON public.sales;
DROP POLICY IF EXISTS "public access suppliers" ON public.suppliers;

-- Revoke anon grants
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.inventory_movements FROM anon;
REVOKE ALL ON public.payables FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.sale_items FROM anon;
REVOKE ALL ON public.sales FROM anon;
REVOKE ALL ON public.suppliers FROM anon;

-- Ensure authenticated grants exist
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

-- Recreate policies scoped to authenticated role only, split per operation so
-- SELECT keeps a documented USING(true) for authed users and writes use WITH CHECK(true).
CREATE POLICY "authenticated read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update customers" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete customers" ON public.customers FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read inv_mov" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write inv_mov" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update inv_mov" ON public.inventory_movements FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete inv_mov" ON public.inventory_movements FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read payables" ON public.payables FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write payables" ON public.payables FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update payables" ON public.payables FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete payables" ON public.payables FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update payments" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete payments" ON public.payments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete products" ON public.products FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update sales" ON public.sales FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete sales" ON public.sales FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);