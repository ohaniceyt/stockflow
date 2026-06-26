-- Drop overly restrictive unique constraint on contact name.
-- Multiple customers (or suppliers) in the same organization can share a name;
-- uniqueness is enforced on email via idx_contacts_org_email_unique.

ALTER TABLE contacts
DROP CONSTRAINT IF EXISTS contacts_org_id_type_name_key;
