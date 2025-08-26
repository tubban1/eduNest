-- Extract db structure 
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;



INSERT INTO user_credits (user_id, change_type, change_amount)
VALUES ('9ebcdda0-ddc4-43b8-afd8-5a6b3b4e98f0', 'manual_adjust', 10);
