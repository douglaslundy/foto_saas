--
-- PostgreSQL database dump
--

\restrict 0g8yjgDCaGo4IrBIZad00R7aI8oIiNFT2uQwIWE3Fyo1edpGFrbg0YZ28mpaL87

-- Dumped from database version 15.18 (Debian 15.18-1.pgdg12+1)
-- Dumped by pg_dump version 15.18 (Debian 15.18-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: banner_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banner_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    storage_path text NOT NULL,
    title text,
    subtitle text,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    session_id text NOT NULL,
    photo_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    price_cents integer
);


--
-- Name: essay_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.essay_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    client_id uuid NOT NULL,
    status text DEFAULT 'pending_selection'::text NOT NULL,
    selected_photo_ids uuid[] DEFAULT '{}'::uuid[],
    notes text,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_intent_id text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    magic_link_expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    access_password text,
    CONSTRAINT essay_reviews_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'manual'::text]))),
    CONSTRAINT essay_reviews_status_check CHECK ((status = ANY (ARRAY['pending_selection'::text, 'submitted'::text, 'in_progress'::text, 'delivered'::text])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    type text DEFAULT 'event'::text NOT NULL,
    event_date date,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    password_hash text,
    price_cents integer DEFAULT 0 NOT NULL,
    facial_recognition_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_image_path text,
    session_price_cents integer DEFAULT 0 NOT NULL,
    included_photo_count integer DEFAULT 0 NOT NULL,
    extra_photo_price_cents integer DEFAULT 0 NOT NULL
);


--
-- Name: COLUMN events.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.status IS 'draft | published | archived | pending_approval';


--
-- Name: face_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.face_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_id uuid NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    face_index smallint DEFAULT 0 NOT NULL,
    embedding public.vector(512) NOT NULL,
    bounding_box jsonb DEFAULT '{}'::jsonb NOT NULL,
    det_score real DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    photo_id uuid,
    event_id uuid,
    price_cents integer DEFAULT 0 NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid,
    client_email text,
    status text DEFAULT 'pending'::text NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    payment_method text,
    payment_provider_id text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    note text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    original_storage_path text,
    public_storage_path text,
    thumbnail_path text,
    bib_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rotation_degrees integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photos_rotation_degrees_check CHECK ((rotation_degrees = ANY (ARRAY[0, 90, 180, 270])))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    cpf_cnpj text NOT NULL,
    city text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    custom_domain text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_storage_path text,
    primary_color text DEFAULT '#3b82f6'::text,
    bio text,
    banner_mode text DEFAULT 'static'::text NOT NULL,
    footer_text text,
    footer_address text,
    footer_phone text,
    footer_whatsapp text,
    footer_instagram text,
    footer_facebook text,
    footer_email text,
    favicon_url text,
    commission_override_percent integer,
    banner_image_path text,
    banner_title text,
    banner_subtitle text,
    banner_cta_text text,
    banner_cta_url text,
    CONSTRAINT tenants_commission_override_percent_check CHECK (((commission_override_percent IS NULL) OR ((commission_override_percent >= 0) AND (commission_override_percent <= 100))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    tenant_id uuid,
    role text DEFAULT 'sub_photographer'::text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    can_create_events boolean DEFAULT true NOT NULL,
    internal_commission_percent integer,
    name text,
    cpf text,
    phone text
);


--
-- Name: watermark_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watermark_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    text_content text,
    font text DEFAULT 'sans-serif'::text NOT NULL,
    font_size integer DEFAULT 24 NOT NULL,
    color text DEFAULT '#ffffff'::text NOT NULL,
    opacity real DEFAULT 0.6 NOT NULL,
    "position" text DEFAULT 'bottom-right'::text NOT NULL,
    image_storage_path text,
    image_size_percent integer DEFAULT 20 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    font_weight integer DEFAULT 700 NOT NULL,
    spacing_x integer DEFAULT 40 NOT NULL,
    spacing_y integer DEFAULT 80 NOT NULL,
    CONSTRAINT watermark_configs_font_weight_check CHECK (((font_weight >= 100) AND (font_weight <= 900))),
    CONSTRAINT watermark_configs_spacing_x_check CHECK (((spacing_x >= 0) AND (spacing_x <= 500))),
    CONSTRAINT watermark_configs_spacing_y_check CHECK (((spacing_y >= 0) AND (spacing_y <= 500)))
);


--
-- Name: banner_images banner_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner_images
    ADD CONSTRAINT banner_images_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_id_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_id_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_session_photo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_session_photo_key UNIQUE (session_id, photo_id);


--
-- Name: essay_reviews essay_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_reviews
    ADD CONSTRAINT essay_reviews_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: events events_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_slug_key UNIQUE (tenant_id, slug);


--
-- Name: face_embeddings face_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.face_embeddings
    ADD CONSTRAINT face_embeddings_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: tenant_registrations tenant_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registrations
    ADD CONSTRAINT tenant_registrations_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: watermark_configs watermark_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watermark_configs
    ADD CONSTRAINT watermark_configs_pkey PRIMARY KEY (id);


--
-- Name: watermark_configs watermark_configs_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watermark_configs
    ADD CONSTRAINT watermark_configs_tenant_id_key UNIQUE (tenant_id);


--
-- Name: banner_images_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX banner_images_tenant_id_idx ON public.banner_images USING btree (tenant_id);


--
-- Name: essay_reviews_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essay_reviews_client_id_idx ON public.essay_reviews USING btree (client_id);


--
-- Name: essay_reviews_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essay_reviews_event_id_idx ON public.essay_reviews USING btree (event_id);


--
-- Name: essay_reviews_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essay_reviews_status_idx ON public.essay_reviews USING btree (tenant_id, status);


--
-- Name: essay_reviews_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essay_reviews_tenant_id_idx ON public.essay_reviews USING btree (tenant_id);


--
-- Name: events_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_tenant_id_idx ON public.events USING btree (tenant_id);


--
-- Name: face_embeddings_embedding_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX face_embeddings_embedding_hnsw ON public.face_embeddings USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: face_embeddings_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX face_embeddings_event_id_idx ON public.face_embeddings USING btree (event_id);


--
-- Name: face_embeddings_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX face_embeddings_expires_at_idx ON public.face_embeddings USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: face_embeddings_photo_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX face_embeddings_photo_id_idx ON public.face_embeddings USING btree (photo_id);


--
-- Name: face_embeddings_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX face_embeddings_tenant_id_idx ON public.face_embeddings USING btree (tenant_id);


--
-- Name: order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);


--
-- Name: orders_client_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_client_email_idx ON public.orders USING btree (client_email);


--
-- Name: payouts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payouts_status_idx ON public.payouts USING btree (status);


--
-- Name: payouts_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payouts_tenant_id_idx ON public.payouts USING btree (tenant_id);


--
-- Name: photos_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photos_event_id_idx ON public.photos USING btree (event_id);


--
-- Name: photos_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX photos_tenant_id_idx ON public.photos USING btree (tenant_id);


--
-- Name: tenant_registrations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_registrations_tenant_id_idx ON public.tenant_registrations USING btree (tenant_id);


--
-- Name: banner_images banner_images_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner_images
    ADD CONSTRAINT banner_images_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- Name: essay_reviews essay_reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- auth.users so existe depois que o GoTrue sobe pela primeira vez, o que
-- acontece DEPOIS deste script de bootstrap do Postgres — por isso essa
-- constraint precisa tolerar a tabela ainda nao existir num deploy do zero.
-- Ela e adicionada de fato pelo docker/db/02-post-auth-fk.sql, que roda
-- depois do stack completo estar de pe (ver README de deploy).
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE ONLY public.essay_reviews
      ADD CONSTRAINT essay_reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id);
  END IF;
END
$$;


--
-- Name: essay_reviews essay_reviews_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_reviews
    ADD CONSTRAINT essay_reviews_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: essay_reviews essay_reviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_reviews
    ADD CONSTRAINT essay_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: photos photos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: photos photos_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_registrations tenant_registrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_registrations
    ADD CONSTRAINT tenant_registrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: watermark_configs watermark_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watermark_configs
    ADD CONSTRAINT watermark_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: essay_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.essay_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: essay_reviews essay_reviews_client_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY essay_reviews_client_select ON public.essay_reviews FOR SELECT USING ((client_id = auth.uid()));


--
-- Name: essay_reviews essay_reviews_client_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY essay_reviews_client_update ON public.essay_reviews FOR UPDATE USING ((client_id = auth.uid())) WITH CHECK ((client_id = auth.uid()));


--
-- Name: essay_reviews essay_reviews_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY essay_reviews_service_role_all ON public.essay_reviews USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_registrations service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.tenant_registrations USING ((auth.role() = 'service_role'::text));


--
-- Name: tenant_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_registrations ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 0g8yjgDCaGo4IrBIZad00R7aI8oIiNFT2uQwIWE3Fyo1edpGFrbg0YZ28mpaL87

