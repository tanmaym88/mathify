-- Flexible student fields (Oct 2026). Any field that isn't needed for sign-in, billing or scheduling
-- lives in this JSON object, so adding a form field never needs another database change.
-- Current keys: student_phone, address_line1, address_line2, state, postal_code, parent_address.
ALTER TABLE students ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
