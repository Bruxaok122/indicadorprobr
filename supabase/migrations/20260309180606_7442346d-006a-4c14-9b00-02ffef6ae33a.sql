
-- Delete contacts that are clearly landlines with 9 prepended (pattern: 55+DDD+9+[2345]XXXXXXX)
-- These are 8-digit landlines that had 9 added by normalizePhone

-- Cristiane: /3, /4, /5 are landlines (4513xxxx, 4555xxxx)
DELETE FROM contacts WHERE id IN (
  'f09c0f34-c4c4-4d69-8a9b-823fd2527a94',
  'e92ed783-de89-41df-aaf7-c48454726439',
  'ebe0750d-c219-482c-b6c4-c639df8961ee'
);

-- ABIGAIL /3 (945524938 = landline 4552-4938)
DELETE FROM contacts WHERE id = 'f0a3f941-77f8-4c44-8c3e-0790e11cedd1';

-- TEONILIO /5 (942209505 = landline 4220-9505)  
DELETE FROM contacts WHERE id = '5e4976b9-181c-45ab-beca-3538ff99446c';

-- Remove duplicate Catarina (same phone, keep first)
DELETE FROM contacts WHERE id = '17f08bc0-a824-49a0-9f14-f1864ee3563f';

-- Fix Cristiane: now has 2 numbers, rename /1 and /2
UPDATE contacts SET name = 'CRISTIANE GALLINDO SILVA /1', process_number = '4020774-12.2025.8.26.0000' WHERE id = 'bb24bf60-d1af-4ab1-95fd-e0253ebf2b92';
UPDATE contacts SET name = 'CRISTIANE GALLINDO SILVA /2', process_number = '4020774-12.2025.8.26.0000' WHERE id = '489d914d-7c81-47ec-bc36-2ab632f70e27';

-- Fix ABIGAIL: now has 4 numbers, rename /4→/3, /5→/4
UPDATE contacts SET name = 'ABIGAIL DE ABREU FONDORA /3' WHERE id = '128b9a8b-8663-4df1-9993-9f1ecdb68c88';
UPDATE contacts SET name = 'ABIGAIL DE ABREU FONDORA /4' WHERE id = 'c0cbcc00-5733-4465-aa4d-db00cbc827a2';

-- Fix TEONILIO: now has 4 numbers, rename
UPDATE contacts SET name = 'TEONILIO MONTEIRO DA COSTA /4' WHERE id = '988f12fc-f1ee-45b3-b48a-5f4077d82fe4';
