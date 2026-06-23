-- Add RPC variant for checking platform admin status by arbitrary user id
CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins WHERE auth_user_id = p_user_id AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed a default platform admin for testing using the existing Alice Admin demo account
INSERT INTO platform_admins (auth_user_id, email, name, is_active)
SELECT id, email, name, TRUE
FROM users
WHERE email = 'earful-wannabe-wok@duck.com'
  AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE auth_user_id = users.id);
