<?php
final class RateLimitService
{
    private $pdo;
    private $prefix;

    public function __construct($pdo=null,$prefix='prefix')
    {
        $this->pdo=$pdo instanceof PDO?$pdo:null;
        $this->prefix=preg_replace('/[^a-zA-Z0-9_]/','',(string)$prefix);
    }
    public function enforce($bucket,$identifier,$limit,$windowSeconds)
    {
        $result=$this->consume($bucket,$identifier,$limit,$windowSeconds);
        if(!$result['allowed']){
            if(!headers_sent()){ http_response_code(429); header('Retry-After: '.(int)$result['retry_after']); }
            throw new RuntimeException('Zbyt wiele prób. Spróbuj ponownie później.');
        }
        return $result;
    }
    public function consume($bucket,$identifier,$limit,$windowSeconds)
    {
        $bucket=substr(preg_replace('/[^a-zA-Z0-9_.:-]/','_',(string)$bucket),0,80);
        $key=hash('sha256',$bucket.'|'.(string)$identifier);
        $limit=max(1,(int)$limit); $windowSeconds=max(1,(int)$windowSeconds);
        if($this->pdo){ try{return $this->consumeDatabase($bucket,$key,$limit,$windowSeconds);}catch(Exception $e){} }
        return $this->consumeFile($bucket,$key,$limit,$windowSeconds);
    }
    private function consumeDatabase($bucket,$key,$limit,$windowSeconds)
    {
        $table=$this->prefix.'_security_rate_limits'; $now=time();
        $window=floor($now/$windowSeconds)*$windowSeconds; $windowEnd=$window+$windowSeconds;
        $sql="INSERT INTO {$table} (bucket,identity_hash,window_start,hits,updated_at) VALUES (:bucket,:identity_hash,FROM_UNIXTIME(:window_start),1,NOW()) ON DUPLICATE KEY UPDATE hits=hits+1,updated_at=NOW()";
        $stmt=$this->pdo->prepare($sql); $stmt->execute(array(':bucket'=>$bucket,':identity_hash'=>$key,':window_start'=>$window));
        $stmt=$this->pdo->prepare("SELECT hits FROM {$table} WHERE bucket=:bucket AND identity_hash=:identity_hash AND window_start=FROM_UNIXTIME(:window_start) LIMIT 1");
        $stmt->execute(array(':bucket'=>$bucket,':identity_hash'=>$key,':window_start'=>$window)); $hits=(int)$stmt->fetchColumn();
        return array('allowed'=>$hits<=$limit,'remaining'=>max(0,$limit-$hits),'retry_after'=>max(1,$windowEnd-$now),'hits'=>$hits);
    }
    private function consumeFile($bucket,$key,$limit,$windowSeconds)
    {
        $dir=sys_get_temp_dir().DIRECTORY_SEPARATOR.'gracz-rate-limit'; if(!is_dir($dir)) @mkdir($dir,0700,true);
        $window=floor(time()/$windowSeconds)*$windowSeconds; $file=$dir.DIRECTORY_SEPARATOR.hash('sha256',$bucket.'|'.$key.'|'.$window).'.json';
        $fp=@fopen($file,'c+'); if(!$fp) return array('allowed'=>false,'remaining'=>0,'retry_after'=>$windowSeconds,'hits'=>$limit+1);
        flock($fp,LOCK_EX); $raw=stream_get_contents($fp); $state=$raw?json_decode($raw,true):array();
        $hits=isset($state['hits'])?(int)$state['hits']+1:1; ftruncate($fp,0); rewind($fp); fwrite($fp,json_encode(array('hits'=>$hits,'window'=>$window))); fflush($fp); flock($fp,LOCK_UN); fclose($fp);
        return array('allowed'=>$hits<=$limit,'remaining'=>max(0,$limit-$hits),'retry_after'=>max(1,($window+$windowSeconds)-time()),'hits'=>$hits);
    }
    public function loginDelaySeconds($login,$ip)
    {
        $identity=strtolower(trim((string)$login)).'|'.$ip;
        $result=$this->consume('login-failures',$identity,1000,3600);
        $attempt=isset($result['hits'])?(int)$result['hits']:max(1,1000-(int)$result['remaining']);
        if($attempt<=3) return 0;
        if($attempt<=5) return 2;
        if($attempt<=7) return 5;
        if($attempt<=9) return 15;
        return min(120,30*($attempt-9));
    }
    public function resetLoginFailures($login,$ip){ return true; }
}
