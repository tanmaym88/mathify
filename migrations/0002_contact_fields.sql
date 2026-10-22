-- Contact form update (Oct 2026): student's own phone, full address, parent/guardian address.
ALTER TABLE students ADD COLUMN student_phone TEXT;
ALTER TABLE students ADD COLUMN address_line1 TEXT;
ALTER TABLE students ADD COLUMN address_line2 TEXT;
ALTER TABLE students ADD COLUMN state TEXT;
ALTER TABLE students ADD COLUMN postal_code TEXT;
ALTER TABLE students ADD COLUMN parent_address TEXT;
