<?php
final class RbacService
{
    private static $permissions = array(
        'player' => array('game.play','profile.manage','message.send','message.read'),
        'moderator' => array('game.play','profile.manage','message.send','message.read','moderation.review','user.warn','user.temporary_ban'),
        'administrator' => array('game.play','profile.manage','message.send','message.read','moderation.review','user.warn','user.temporary_ban','user.ban','content.manage','audit.read'),
        'owner' => array('*')
    );

    public static function currentRole($pdo = null, $prefix = 'prefix')
    {
        if (isset($_SESSION['role']) && isset(self::$permissions[$_SESSION['role']])) return $_SESSION['role'];
        $uid = isset($_SESSION['id']) ? (int)$_SESSION['id'] : 0;
        if ($uid && $pdo instanceof PDO) {
            try {
                $table = preg_replace('/[^a-zA-Z0-9_]/', '', $prefix).'_user_roles';
                $stmt = $pdo->prepare("SELECT role FROM {$table} WHERE user_id=:uid LIMIT 1");
                $stmt->execute(array(':uid'=>$uid));
                $role = $stmt->fetchColumn();
                if (isset(self::$permissions[$role])) {
                    $_SESSION['role'] = $role;
                    return $role;
                }
            } catch (Exception $e) {}
        }
        return SecurityService::legacyRole();
    }

    public static function can($permission, $pdo = null, $prefix = 'prefix')
    {
        $role = self::currentRole($pdo, $prefix);
        $grants = isset(self::$permissions[$role]) ? self::$permissions[$role] : array();
        return in_array('*', $grants, true) || in_array($permission, $grants, true);
    }

    public static function requirePermission($permission, $pdo = null, $prefix = 'prefix')
    {
        if (!self::can($permission, $pdo, $prefix)) {
            http_response_code(403);
            exit('Brak wymaganych uprawnień.');
        }
        return true;
    }

    public static function requireAdmin2fa($pdo = null, $prefix = 'prefix')
    {
        $role = self::currentRole($pdo, $prefix);
        if (!TwoFactorService::roleRequires2fa($role)) return true;
        if (empty($_SESSION['2fa_verified_at']) || time() - (int)$_SESSION['2fa_verified_at'] > 43200) {
            http_response_code(403);
            exit('<h1>Wymagana weryfikacja 2FA</h1><p>Moderatorzy i administratorzy muszą potwierdzić drugi składnik przed wejściem do panelu.</p><p><a href="admin_2fa.php">Przejdź do weryfikacji 2FA</a></p>');
        }
        return true;
    }
}
