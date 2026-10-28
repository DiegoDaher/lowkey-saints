-- Runtime role has no schema ownership or RLS bypass. Provision login separately.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lowkey_api') THEN
  CREATE ROLE lowkey_api NOLOGIN NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO lowkey_api;
ALTER TABLE "Product" ADD CONSTRAINT product_price_nonnegative CHECK ("salePrice">=0), ADD CONSTRAINT model_height_positive CHECK ("modelHeightCm" IS NULL OR "modelHeightCm">0);
ALTER TABLE "ProductCost" ADD CONSTRAINT cost_nonnegative CHECK ("costPrice">=0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT stock_nonnegative CHECK (stock>=0), ADD CONSTRAINT variant_version_nonnegative CHECK (version>=0);
ALTER TABLE "Order" ADD CONSTRAINT total_nonnegative CHECK ("totalAmount">=0), ADD CONSTRAINT currency_mxn CHECK (currency='MXN');
ALTER TABLE "OrderItem" ADD CONSTRAINT quantity_positive CHECK (quantity>0), ADD CONSTRAINT price_nonnegative CHECK (price>=0);
ALTER TABLE "ProductImage" ADD CONSTRAINT image_position_valid CHECK (position BETWEEN 0 AND 11);
ALTER TABLE "ProductComplement" ADD CONSTRAINT complement_not_self CHECK ("productId"<>"complementaryId"), ADD CONSTRAINT complement_position_valid CHECK (position BETWEEN 0 AND 2);
ALTER TABLE "SizeMeasurement" ADD CONSTRAINT measures_positive CHECK (("chestCm" IS NULL OR "chestCm">0) AND ("waistCm" IS NULL OR "waistCm">0) AND ("hipCm" IS NULL OR "hipCm">0));
ALTER TABLE "RestockSubscription" ADD CONSTRAINT email_normalized CHECK (email=lower(trim(email)));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Product','ProductCost','Category','ProductCategory','ProductImage','SizeMeasurement','ProductComplement','ProductVariant','Order','OrderItem','RestockSubscription','Notification','AdminProfile','RateLimit'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated',t); END IF;
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO lowkey_api',t);
  EXECUTE format('CREATE POLICY backend_only ON public.%I TO lowkey_api USING (true) WITH CHECK (true)',t);
 END LOOP;
 IF to_regclass('auth.users') IS NOT NULL THEN
  ALTER TABLE "AdminProfile" ADD CONSTRAINT admin_auth_user FOREIGN KEY(id) REFERENCES auth.users(id) ON DELETE CASCADE;
 END IF;
END $$;
GRANT USAGE,SELECT ON SEQUENCE "Order_orderNumber_seq" TO lowkey_api;
-- No browser policies: all business access is authorized by Edge Functions.
INSERT INTO "Category" (id,name,slug) VALUES
 ('00000000-0000-4000-8000-000000000001','Tops','tops'),
 ('00000000-0000-4000-8000-000000000002','Pantalones','pantalones'),
 ('00000000-0000-4000-8000-000000000003','Accesorios','accesorios'),
 ('00000000-0000-4000-8000-000000000004','Drops','drops'),
 ('00000000-0000-4000-8000-000000000005','Calzado','calzado');
-- Storage metadata only. Supabase manages the storage schema itself.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES ('product-images','product-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT(id) DO NOTHING;
 END IF;
END $$;
