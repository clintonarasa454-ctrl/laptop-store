ALTER TABLE "products" ADD COLUMN "warehouseId" integer;
ALTER TABLE "drivers" ADD COLUMN "warehouseId" integer;
ALTER TABLE "vehicles" ADD COLUMN "warehouseId" integer;
ALTER TABLE "deletion_requests" ADD COLUMN "warehouseId" integer;

DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_warehouseId_warehouses_id_fk" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_warehouseId_warehouses_id_fk" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_warehouseId_warehouses_id_fk" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_warehouseId_warehouses_id_fk" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;