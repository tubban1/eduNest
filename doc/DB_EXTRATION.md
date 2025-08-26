-- Extract db structure 
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;



INSERT INTO user_credits (user_id, change_type, change_amount)
VALUES ('f720cad3-6527-4d1d-a0ab-6c33da21d215', 'manual_adjust', 10);
