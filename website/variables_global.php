<?php

/* Global configuration. Secrets MUST come from environment variables. */
include('constants_global.php');
include('kody_bledow.php');

function GraczEnv($name, $default = null, $required = false)
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        if ($required) {
            throw new RuntimeException('Missing required environment variable: '.$name);
        }
        return $default;
    }
    return $value;
}

$environment = GraczEnv('GRACZ_ENV', 'development');
$production_mode = ($environment === 'production');
$domain = GraczEnv('GRACZ_DOMAIN', 'localhost');
$scheme = GraczEnv('GRACZ_SCHEME', $production_mode ? 'https' : 'http');
$kontakt_email = GraczEnv('GRACZ_CONTACT_EMAIL', 'kontakt@'.$domain);
$reklama_email = GraczEnv('GRACZ_AD_EMAIL', 'reklama@'.$domain);
$service_name = GraczEnv('GRACZ_SERVICE_NAME', 'Gracz.pl').' &trade;';
$service_base_address = rtrim(GraczEnv('GRACZ_BASE_URL', $scheme.'://'.$domain.'/'), '/').'/';

$directory['base'] = $actual_path;
$directory['design'] = $directory['base'].'design/';
$directory['emoticons'] = $directory['design'].'emotikony/';
$directory['logi'] = $directory['base'].'logi/';
$directory['terms_of_service'] = $directory['base'].'regulaminy/';
$directory['advertisements'] = $directory['base'].'reklamy/';
$directory['scripts'] = $directory['base'].'skrypty/';
$directory['scripts_fancybox'] = $directory['scripts'].'jquery.fancybox/';
$directory['scripts_infinite_carousel'] = $directory['scripts'].'infinite_carousel/';
$directory['scripts_example'] = $directory['scripts'].'example/';
$directory['games'] = $directory['base'].'games_directory/';

$path['css_stylesheet'] = $directory['design'].'style.css';
$path['css_stylesheet_smallscreen'] = $directory['design'].'style_smallscreen.css';
$path['css_stylesheet_jquery'] = $directory['design'].'jquery.theme.gracz/jquery-ui-1.10.4.custom.css';
$path['log_errors_php'] = $directory['logi'].'php_errors.log';
$path['log_exceptions_php'] = $directory['logi'].'php_exceptions.log';
$path['log_daily'] = $directory['logi'].'log_daily.log';
$path['search'] = $directory['base'].'wyszukaj';
$path['contact'] = $directory['base'].'contact';
$path['help'] = $directory['base'].'pomoc';
$path['login'] = $directory['base'].'login';
$path['account_settings'] = $directory['base'].'settings';
$path['privacy_policy'] = $directory['base'].'privacy_policy';
$path['profile_edit'] = $path['account_settings'];
$path['register'] = $directory['base'].'register';
$path['logout'] = $directory['base'].'wyloguj';
$path['admin_game_add'] = $directory['base'].'gry_dodaj';
$path['admin_panel'] = $directory['base'].'service_administration_panel';
$path['admin_reported_abuses'] = $directory['base'].'admin_reported_abuses';
$path['admin_reported_bugs'] = $directory['base'].'admin_reported_bugs';
$path['log_IP'] = $directory['logi'].'log_IP.txt';
$path['terms_of_service_txt'] = $directory['terms_of_service'].'regulamin.txt';
$path['privacy_policy_txt'] = $directory['terms_of_service'].'polityka_prywatnosci.txt';
$path['terms_of_service'] = $directory['base'].'regulamin';
$path['games'] = $directory['base'].'gry';
$path['statistics'] = $directory['base'].'statystyki';
$path['attentions'] = $directory['base'].'uwagi';
$path['rank'] = $directory['base'].'ranking';
$path['tournaments'] = $directory['base'].'turnieje';
$path['activate_account'] = $directory['base'].'activateAccount';
$path['facebook_registration'] = $directory['base'].'facebookRegistration';
$path['send_activation_email_again'] = $directory['base'].'wyslij_list_ponownie';
$path['remember_password'] = $directory['base'].'rememberPassword';
$path['delete_account'] = $directory['base'].'usun_konto';
$path['profile'] = $directory['base'].'profil';
$path['password_change'] = $directory['base'].'zmiana_hasla';
$path['news'] = $directory['base'].'newsy';
$path['daily'] = $directory['base'].'daily';
$path['advertisement_management'] = $directory['base'].'advertisement_management';
$path['code_paste_management'] = $directory['base'].'code_paste_management';
$path['mailing'] = $directory['base'].'mailing';
$path['block'] = $directory['base'].'block';
$path['friends'] = $directory['base'].'friends';
$path['conversation'] = $directory['base'].'conversation';
$path['passwordChanged'] = $directory['base'].'passwordChanged';
$path['online_users'] = $directory['base'].'online_users';
$path['ajaxAboutUserWindow'] = $directory['base'].'ajaxAboutUserWindow';
$path['ajaxGameplayMovesWindow'] = $directory['base'].'ajaxGameplayMovesWindow';
$path['ajaxBlacklist'] = $directory['base'].'ajaxBlacklist';
$path['ajaxAbuse'] = $directory['base'].'ajaxAbuse';
$path['ajaxBug'] = $directory['base'].'ajaxBug';
$path['ajaxFriends'] = $directory['base'].'ajaxFriends';
$path['ajaxConversation'] = $directory['base'].'ajaxConversation';
$path['ajaxInvitations'] = $directory['base'].'ajaxInvitations';
$path['ajaxAdvertisements'] = $directory['base'].'ajaxAdvertisements';
$path['library_main'] = $directory['base'].'library_main.php';
$path['library_games'] = $directory['base'].'library_games.php';
$path['library_facebook'] = $directory['base'].'library_facebook.php';

$cpu_load = sys_getloadavg();
$cpu_load = isset($cpu_load[0]) ? floatval($cpu_load[0]) : 0;
$max_number_of_results_per_page = 9;
$max_number_of_users_per_page = 15;
$minimal_password_length = 12;
$time_after_which_inactive_accounts_will_be_deleted = 7;
$database_handle = null;
$query_counter = 0;
$miniature_size = 105;
$conversations_checking_period_normal = (2+5*$cpu_load)*1000;
$conversations_checking_period_lazy = (3+15*$cpu_load)*1000;
$player_active_state_time_period = 15;

// OAuth/DB/application secrets are intentionally not committed.
$facebook_client_id = GraczEnv('FACEBOOK_CLIENT_ID', '');
$facebook_app_secret = GraczEnv('FACEBOOK_APP_SECRET', '');
$smartfox_port = intval(GraczEnv('SMARTFOX_PORT', '8888'));
$smartfox_address = GraczEnv('SMARTFOX_ADDRESS', isset($_SERVER['SERVER_ADDR']) ? $_SERVER['SERVER_ADDR'] : '127.0.0.1');
$remote_IP = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

// Legacy password pepper. Keep it outside Git and rotate only together with password migration.
$seed_private = GraczEnv('GRACZ_PASSWORD_PEPPER', '', $production_mode);

$database_address = GraczEnv('DB_HOST', '127.0.0.1:3306', $production_mode);
$database_username = GraczEnv('DB_USER', 'gracz_app', $production_mode);
$database_password = GraczEnv('DB_PASSWORD', '', $production_mode);
$database_name = GraczEnv('DB_NAME', 'gracz', $production_mode);
$database_prefix = preg_replace('/[^a-zA-Z0-9_]/', '', GraczEnv('DB_PREFIX', 'prefix'));
