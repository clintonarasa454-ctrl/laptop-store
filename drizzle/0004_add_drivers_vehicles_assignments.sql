-- Create driver_status enum
CREATE TYPE "public"."driver_status" AS ENUM('active', 'inactive');
--> statement-breakpoint

-- Create vehicle_type enum  
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'motorcycle', 'truck');
--> statement-breakpoint

-- Create vehicle_status enum
CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'assigned', 'maintenance');
--> statement-breakpoint

-- Create assignment_status enum
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed');
--> statement-breakpoint

-- Create drivers table
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(320),
	"license_number" varchar(50),
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"pin" varchar(256) NOT NULL,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "drivers_email_unique" UNIQUE("email")
);
--> statement-breakpoint

-- Create vehicles table
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"number_plate" varchar(20) NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"status" "vehicle_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_number_plate_unique" UNIQUE("number_plate")
);
--> statement-breakpoint

-- Create assignments table
CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"status" "assignment_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint

-- Add foreign keys for assignments
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade;
