CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'negotiating', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'sales');--> statement-breakpoint
CREATE TABLE "catalog_versions" (
	"tenant_id" uuid NOT NULL,
	"version" text NOT NULL,
	"catalog" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_versions_tenant_id_version_pk" PRIMARY KEY("tenant_id","version")
);
--> statement-breakpoint
CREATE TABLE "config_revisions" (
	"config_id" text NOT NULL,
	"revision" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"catalog_version" text NOT NULL,
	"config" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_revisions_config_id_revision_pk" PRIMARY KEY("config_id","revision")
);
--> statement-breakpoint
CREATE TABLE "configs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"current_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"data" "bytea" NOT NULL,
	"config_id" text,
	"revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"config_id" text NOT NULL,
	"revision" integer NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"contact" jsonb NOT NULL,
	"locale" text NOT NULL,
	"price_total" integer NOT NULL,
	"photo_file_id" uuid,
	"offer_pdf_file_id" uuid,
	"tech_pdf_file_id" uuid,
	"bom_xlsx_file_id" uuid,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"active_catalog_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_versions" ADD CONSTRAINT "catalog_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_config_id_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configs" ADD CONSTRAINT "configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_config_id_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rev_tenant_idx" ON "config_revisions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "configs_tenant_idx" ON "configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "files_tenant_idx" ON "files" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "files_config_idx" ON "files" USING btree ("config_id","revision");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "leads_tenant_idx" ON "leads" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email" ON "users" USING btree ("tenant_id",lower("email"));