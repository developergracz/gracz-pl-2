<?php
final class AdminActionService
{
    private $pdo;
    private $prefix;
    private $audit;

    public function __construct(PDO $pdo, $prefix, AuditService $audit)
    {
        $this->pdo=$pdo;
        $this->prefix=preg_replace('/[^a-zA-Z0-9_]/','',(string)$prefix);
        $this->audit=$audit;
    }

    public function changeRole($targetUserId, $newRole, $actorUserId)
    {
        RbacService::requirePermission('audit.read',$this->pdo,$this->prefix);
        $allowed=array('player','moderator','administrator','owner');
        if(!in_array($newRole,$allowed,true)) throw new InvalidArgumentException('Nieprawidłowa rola.');
        if($newRole==='owner' && RbacService::currentRole($this->pdo,$this->prefix)!=='owner') throw new RuntimeException('Tylko właściciel może nadać rolę właściciela.');
        $table=$this->prefix.'_user_roles';
        $stmt=$this->pdo->prepare("INSERT INTO {$table}(user_id,role,created_at,updated_at) VALUES(:uid,:role,NOW(),NOW()) ON DUPLICATE KEY UPDATE role=VALUES(role),updated_at=NOW()");
        $ok=$stmt->execute(array(':uid'=>(int)$targetUserId,':role'=>$newRole));
        $this->audit->record('admin.role.changed',$actorUserId,array('target_user_id'=>(int)$targetUserId,'new_role'=>$newRole),'warning');
        return $ok;
    }

    public function recordBan($target, $action, $actorUserId, callable $operation)
    {
        if(!in_array($action,array('ban','unban'),true)) throw new InvalidArgumentException('Nieprawidłowa akcja.');
        $result=$operation();
        $this->audit->record('admin.user.'.$action,$actorUserId,array('target_hash'=>hash('sha256',(string)$target),'success'=>(bool)$result),'warning');
        return $result;
    }

    public function recordDeletion($objectType, $objectId, $actorUserId, callable $operation)
    {
        $result=$operation();
        $this->audit->record('admin.data.deleted',$actorUserId,array('object_type'=>substr((string)$objectType,0,60),'object_id'=>(int)$objectId,'success'=>(bool)$result),'critical');
        return $result;
    }

    public function recordEmailChange($targetUserId, $actorUserId, callable $operation)
    {
        $result=$operation();
        $this->audit->record('account.email.changed',$actorUserId,array('target_user_id'=>(int)$targetUserId,'success'=>(bool)$result),'warning');
        return $result;
    }
}
