<?php
final class UploadSecurityService
{
    private static $allowed = array(
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'text/plain' => 'txt',
        'application/json' => 'json'
    );

    public static function store(array $file, $destinationDir, $maxBytes = 5242880)
    {
        if (!isset($file['error']) || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Nieprawidłowy upload.');
        }
        if (!isset($file['size']) || (int)$file['size'] <= 0 || (int)$file['size'] > $maxBytes) {
            throw new RuntimeException('Plik jest pusty lub zbyt duży.');
        }
        if (!is_uploaded_file($file['tmp_name'])) {
            throw new RuntimeException('Plik nie pochodzi z bezpiecznego uploadu HTTP.');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!isset(self::$allowed[$mime])) {
            throw new RuntimeException('Ten format pliku nie jest dozwolony.');
        }

        $extension = self::$allowed[$mime];
        $providedExt = strtolower(pathinfo(isset($file['name']) ? $file['name'] : '', PATHINFO_EXTENSION));
        $validAliases = $extension === 'jpg' ? array('jpg','jpeg') : array($extension);
        if ($providedExt !== '' && !in_array($providedExt, $validAliases, true)) {
            throw new RuntimeException('Rozszerzenie pliku nie zgadza się z jego rzeczywistym formatem.');
        }

        if (strpos($mime, 'image/') === 0 && @getimagesize($file['tmp_name']) === false) {
            throw new RuntimeException('Uszkodzony lub fałszywy plik graficzny.');
        }
        if ($mime === 'application/json') {
            $raw = file_get_contents($file['tmp_name']);
            json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new RuntimeException('Nieprawidłowy plik JSON.');
            }
        }

        if (!is_dir($destinationDir) && !mkdir($destinationDir, 0750, true)) {
            throw new RuntimeException('Nie można przygotować katalogu uploadów.');
        }
        $filename = bin2hex(random_bytes(24)).'.'.$extension;
        $target = rtrim($destinationDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$filename;
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            throw new RuntimeException('Nie udało się zapisać pliku.');
        }
        @chmod($target, 0640);
        return array('filename' => $filename, 'mime' => $mime, 'size' => (int)$file['size']);
    }
}
