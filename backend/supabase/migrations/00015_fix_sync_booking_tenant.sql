-- ============================================================================
-- Migration 00015: Fix sync_booking_tenant for global resources
-- ============================================================================
-- Migration 00011 made bookings.tenant_id nullable to support global
-- resources, but the sync_booking_tenant() trigger still raises an
-- exception when the resolved tenant_id is NULL. This update allows NULL
-- for global resources while still erroring on invalid resource_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_booking_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id uuid;
    v_resource_exists boolean;
BEGIN
    -- Check if the resource exists
    SELECT EXISTS(SELECT 1 FROM public.resources WHERE id = new.resource_id) INTO v_resource_exists;

    IF NOT v_resource_exists THEN
        RAISE EXCEPTION 'Resource % does not exist', new.resource_id;
    END IF;

    -- Get the tenant_id from the resource (may be NULL for global resources)
    SELECT tenant_id INTO v_tenant_id
    FROM public.resources
    WHERE id = new.resource_id;

    new.tenant_id = v_tenant_id;

    RETURN new;
END;
$$;
