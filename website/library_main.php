<?php
/**
 * Moduł ten zawiera większość funkcji wykorzystywanych przez serwis
 * Łukasz "Lukas" Wyporek, 2013 ... www.lukashp.pl
 *
 * Dane przechowywane w sesji PHP:
 * account_type => określa czy użytkownik jest userem czy administratorem, czy też ADMINISTRATORem
 * login => login użytkownika
 * hash SHA1 + ziarno => zahaszowane hasło zmieszane z ziarnem
 * adres IP => część systemu zabezpieczającego zapobiegania przejęciu sesji PHP
 *
 * @author       Łukasz Wyporek <zlecenia.www@gmail.com>
 * @version      1.2
 * @package      Gracz
 * @subpackage   MainLibrary
 * @category     Library
 */


/**
 * Funkcja nawiązuje połączenie z bazą danych. W przypadku powodzenia zwraca true. Jeśli wystąpi błąd następuje
 * przerwanie wykonywania skryptu przy użyciu funkcji die().
 * @return boolean
 * @see DatabaseDisconnect
 * @global
 */
function DatabaseConnect()
{
	global $database_handle, $database_address, $database_username, $database_password, $database_name;
	
	// Jeśli jakieś połączenie jest już nawiązane to nie rób nic
	if ($database_handle != null) {
		return true;
	}
	
	try {
		$database_handle = new PDO('mysql:host='.$database_address.';dbname='.$database_name.';charset=utf8',
			$database_username, $database_password);
		$database_handle->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	} catch (PDOException $e) {
		die('Nie można się połączyć z bazą danych.');
	}
	return true;
}

/**
 * Funkcja zakańcza połączenie z bazą danych.
 * @global
 * @see DatabaseDisconnect
 */

function DatabaseDisconnect()
{
	global $database_handle;
	
	if ($database_handle != null) {
		$database_handle = null;
	}
}

/**
 * Returns user session status
 * @return string Returns sessions status, one of the following: active, disabled, none
 */
function getSessionStatusDescription()
{
	switch (session_status()) {
		case PHP_SESSION_ACTIVE:
			return 'active';
			break;
		case PHP_SESSION_DISABLED:
			return 'disabled';
			break;
		case PHP_SESSION_NONE:
			return 'none';
			break;
	}
}

/**
 * Uwierzytelnia użytkownika. Tworzy sesję dla użytkownika jeśli uwierzytelnianie się powiodło.
 * @param Login użytkownika
 * @param Hasło użytkownika
 * @return boolean Zwraca True jeśli operacja się powiodła, lub False w przypadku błędu.
 * @see Logout
 */

function AuthorizeUser(
	$param_login = null,
	$param_password = null,
	$param_remember_session = false,
	$facebook_force_login = false
) {
	global $database_handle, $database_prefix, $remote_IP, $seed_private, $directory;
	
	$login = addslashes($param_login);
	$login = str_replace(['%', '_'], '', $login);
	$password = sha1($seed_private.$param_password);
	$remember_session = ($param_remember_session ? true : false);
	$session_id = addslashes(htmlspecialchars(session_id()));
	$facebook_force_login = $facebook_force_login ? true : false;
	
	if ($remember_session) {
		session_set_cookie_params(60 * 60 * 24 * 30, '/');
	}
	
	if (!isset($_SESSION['token'])) {
		GenerateNewToken();
	}
	
	// Bez możliwości pustych haseł (no chyba, że wewnętrzne wymuszenie logowania z Facebooka)
	if ($param_login != '' && ($param_password != '' || $facebook_force_login)) { // następuje sprawdzenie wszystkiego i jeśli OK to zalogowanie
		// Jeśli użytkownik chce sie zalogować na jakieś konto a jest już zalogowany (sesja jest zainicjowana) to najpierw wyloguj chyba, że użytkownik chce się zalogować ponownie na to samo konto będąc już zalogowanym to nie rób nic
		if ($_SESSION['initiated']) {
			// TODO: A może dodać jeszcze || ($_SESSION['email']==$login)
			if (($_SESSION['login'] == $login) && (($_SESSION['password'] == $password) || $facebook_force_login)) {// Jeśli użytkownik chce się zalogować na to samo konto będąc już zalogowanym to nie rób nic
				// Przy np. odświerzaniu strony (która przesyła informacje o loginie i hasśle) też zmodyfikuj wpis o ostatnich odwiedzinach
				// Zapisz datę i adres IP ostatniej wizyty w bazie
				
				$query = 'UPDATE '.$database_prefix.'_users
                         SET date_last_visit = CURRENT_TIMESTAMP(),
                             logged_in = true,
                             IP = :remote_ip,
                             session_id = :session_id
                       WHERE id = :current_session_id
                       LIMIT 1';
				$stmt = $database_handle->prepare($query);
				$stmt->bindValue(':remote_ip', $remote_IP);
				$stmt->bindValue(':session_id', $session_id);
				$stmt->bindValue(':current_session_id', $_SESSION['id']);
				$stmt->execute();
				
				return true;
			} else {// Jeśli użytkownik chce się zalogować na inne konto będąc już zalogowanym to najpierw go wyloguj
				Logout();
			}
		}
		
		
		if (!$_SESSION['initiated']) // Funkcja Logout() zmienia zawartość $_SESSION, więc trzeba postawić nowy warunek (nie wystarczy else)
		{ // tworzenie nowej sesji
			// Sprawdź czy użytkownik o podanym loginie i haśle istnieje w bazie danych
			$query = 'SELECT COUNT(*) AS number_of_selected_users,
					   id,
                       id_facebook,
                       account_type,
                       login,
                       email,
                       password,
                       can_change_login,
                       dont_show_my_friends_to_others,
                       show_desktop_notifications,
                       play_new_message_sound
                  FROM '.$database_prefix.'_users
                 WHERE ('.($facebook_force_login ? '' : 'login LIKE :login OR ').' email=:login) '.($facebook_force_login ? '' : ' AND password = :password ').
				'LIMIT 1';
			
			// bez sprawdzania hasła kiedy następuje wewnętrzne żądanie zalogowania na konto założone przez facebooka (one nie mają haseł)
			$stmt = $database_handle->prepare($query);
			$stmt->bindValue(':login', $login);
			if (!$facebook_force_login) {
				$stmt->bindValue(':password', $password);
			}
			
			$stmt->execute();
			
			// Baza pilnuje, żeby był tylko jeden użytkownik (nie więcej) o danym loginie i haśle
			
			$row = $stmt->fetch();
			
			if (intval($row['number_of_selected_users']) > 0) {
				// Przy tworzeniu nowej sesji, dzięki funkcji session_regenerate_id() mamy pewność, że sesja dostanie losowy ID
				// UWAGA: Niewywołanie tej funkcji pociąga za sobą to, ze użytkownik który zaloguje się po wylogowaniu poprzedniego, będzie miał taki sam identyfikator sesji!!!
				session_regenerate_id();
				
				$_SESSION['initiated'] = true;
				
				// Wywoływane przy zalogowaniu
				DailyAdd('Wykonano logowanie na konto użytkownika "'.$login.'".', LEVEL_INF);
				
				$_SESSION['id'] = $row['id'];
				$_SESSION['id_facebook'] = $row['id_facebook'];
				$_SESSION['login'] = $row['login'];
				$_SESSION['email'] = $row['email'];
				$_SESSION['password'] = $row['password'];
				$_SESSION['account_type'] = $row['account_type'];
				$_SESSION['can_change_login'] = $row['can_change_login'];
				$_SESSION['dont_show_my_friends_to_others'] = $row['dont_show_my_friends_to_others'] == 1 ? true : false;
				GenerateNewToken();
				try {
					$_SESSION['friends'] = GetFriendList();
				} catch (ExceptionNoResults $e) {
				}
				try {
					$_SESSION['blacklist'] = GetUserBlackList();
				} catch (ExceptionNoResults $e) {
				}
				
				// Zapisz datę i adres IP ostatniej wizyty w bazie
				$query = 'UPDATE '.$database_prefix.'_users
                         SET date_last_visit = CURRENT_TIMESTAMP(),
                             date_last_login = CURRENT_TIMESTAMP(),
                             logged_in = true,
                             IP = :remote_ip,
                             session_id = :session_id,
                             token = :current_session_token
                       WHERE id = :current_session_id
                       LIMIT 1';
				
				$stmt = $database_handle->prepare($query);
				$stmt->bindValue(':remote_ip', $remote_IP);
				$stmt->bindValue(':session_id', $session_id);
				$stmt->bindValue(':current_session_id', $_SESSION['id']);
				$stmt->bindValue(':current_session_token', $_SESSION['token']);
				$stmt->execute();
				
				$_SESSION['host'] = GetHostByAddr($_SERVER['REMOTE_ADDR']);
				$_SESSION['remember_me'] = $remember_session;
				// Tablica profil będzie zawierać dane profilowe użytkownika
				$_SESSION['profile'] = GetAccountDetails($row['id']);
				
				// Zapisywanie w pliku logowań nadużytkowników
				if ($_SESSION['account_type'] > USER) {
					$plik = fopen($directory['logi']."superuser_IP_addresses.txt", "a+");
					fwrite($plik,
						date("Y-m-d H:i:s").' z adresu '.$_SERVER['REMOTE_ADDR'].' na konto '.$_SESSION['login']."\r\n");
					fclose($plik);
				}
				return true;
			} else { // Jeśli nie znaleziono użytkowników o takim loginie to błąd
				return false;
			}
		}
	} else {
		if ($param_login == null && $param_password == null) // login i hasło jest puste (np. funkcja wywołana bez parametrów (z domyślnymi parametrami) lub użytkownik nie wpisał loginu i hasła)
		{
			// następuje sprawdzenie czy użytkownik nie został już zalogowany
			// Jeśli użytkownik nie jest zalogowany to wyjdź
			if (!$_SESSION['initiated']) {
				return false;
			}
			
			// niezmiennik: użytkownik jest juz zalogowany (sesja została zainicjowana)
			
			// Przy np. odświerzaniu strony też zmodyfikuj wpis o ostatnich odwiedzinach
			// Zapisz datę i adres IP ostatniej wizyty w bazie
			$query = 'UPDATE '.$database_prefix.'_users
                 SET date_last_visit = CURRENT_TIMESTAMP(),
                     logged_in = true,
                     IP = :remote_ip,
                     session_id = :session_id
               WHERE id = :current_session_id
               LIMIT 1';
			$stmt = $database_handle->prepare($query);
			$stmt->bindValue(':remote_ip', $remote_IP);
			$stmt->bindValue(':session_id', $session_id);
			$stmt->bindValue(':current_session_id', $_SESSION['id']);
			$stmt->execute();
			
			return true;
		}
	}
	
	throw new ExceptionUnexpected();
}


// Tylko po zalogowaniu
/**
 * Wylogowuje użytkownika z serwisu, oznacza jako wylogowanego (w bazie danych) i niszczy jego sesję.
 * @return bool
 */
function Logout()
{
	global $database_handle, $database_prefix;
	
	// Jeśli użytkownik nie jest zalogowany to zwróć zakończ i zwróć False (nie można wylogować)
	if (!isset($_SESSION['initiated'])) {
		session_destroy();
		return false;
	}
	
	// Oznacz użytkownika jako wylogowanego
	$query = 'UPDATE '.$database_prefix.'_users
                   SET logged_in = 0
                 WHERE id = :session_id
                 LIMIT 1';
	$stmt = $database_handle->prepare($query);
	$stmt->bindValue(':session_id', $_SESSION['id']);
	$stmt->execute();
	
	DailyAdd('Wylogowano użytkownika "'.$_SESSION['login'].'" (o ID='.$_SESSION['id'].').', LEVEL_INF);
	
	unset($_SESSION['login']);
	unset($_SESSION['password']);
	unset($_SESSION['id']);
	unset($_SESSION['account_type']);
	unset($_SESSION['initiated']);
	unset($_SESSION['host']);
	unset($_SESSION['profile']);
	unset($_SESSION['ustawienia']);
	session_destroy();
	session_start();
	
	return true;
}

/**
 * Sprawdza czy podany jako parametr token jest prawidłowy w tej sesji (dotyczy zabezpieczenia serwisu przed atakami
 * typu CSRF)
 * @param $token Token bezpieczeństwa przesłany przez klienta
 * @return bool True w przypadku gdy token jest prawidłowy, False w przypadku gdy token jest błędny
 */
function IsTokenValid($token)
{
	// Sprawdza poprawność podanego tokenu z tym, który był używany przy poprzednim wywołaniu skryptu
	return ($token == $_SESSION['token']);
}

/** Funkcja oblicza wiek na podstawie podanej jako parametr daty i pobranego, aktualnego czasu
 * @param: string Data urodzenia w formacie YYYY-MM-DD lub YYYY-M-D
 * @return int Wiek osoby
 */
function CalculateAge($birth_date)
{
	if (trim($birth_date) == '') {
		return BLAD_NIEPRAWIDLOWE_DANE;
	}
	
	$now = explode('-', date('Y-m-d'));
	$date = explode('-', $birth_date);
	$years = $now[0] - $date[0];
	$months = $now[1] - $date[1];
	$days = $now[2] - $date[2];
	
	if ($months <= 0) {
		if ($days < 0) {
			$years--;
		}
	}
	return $years;
}

/* Zwraca ciekawostki dotyczące portalu
  number_of_all_users
  number_of_active_users
  number_of_online_users
  number_of_female_users
  number_of_male_users
  number_of_games
  number_of_plays
*/
/**
 * Wyciąga z bazy statystyki dotyczące całego serwisu.
 * @return array Zwraca tablicę zawierająca poniższe informacje:<br />
 * number_of_all_users - ilość wszystkich użytkowników serwisu<br />
 * number_of_active_users - ilość aktywnych użytkowników (którzy potwierdzili swój adres e-mail)<br />
 * number_of_online_users - ilość użytkowników dostępnych online<br />
 * number_of_blocked_users - ilość zablokowanych użytkowników<br />
 * number_of_female_users - ilość kobiet wśród użytkowników<br />
 * number_of_male_users - ilość mężczyzn wśród użytkowników<br />
 * number_of_games - liczba zainstalowanych w serwisie gier online<br />
 * number_of_plays - liczba stoczonych rozgrywek w historii serwisu<br />
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getServiceStatistics()
{
	global $database_handle, $database_prefix, $player_active_state_time_period;
	
	$query = '
    SELECT (
             SELECT COUNT(*) FROM '.$database_prefix.'_users
           ) AS number_of_all_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_users WHERE active = true
           ) AS number_of_active_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_users WHERE logged_in = true /* active = true AND TIMEDIFF(NOW(), date_last_visit)/60 <= '.$player_active_state_time_period.' */
           ) AS number_of_online_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_users WHERE blocked = true
           ) AS number_of_blocked_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_users WHERE sex = :sex_female
           ) AS number_of_female_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_users WHERE sex = :sex_male
           ) AS number_of_male_users,
           (
             SELECT COUNT(*) FROM '.$database_prefix.'_games
           ) AS number_of_games,
           (
             SELECT ROUND(COUNT(*)) FROM '.$database_prefix.'_gameplays
           ) AS number_of_plays
  ';
	$stmt = $database_handle->prepare($query);
	$stmt->bindValue(':sex_female', SEX_FEMALE);
	$stmt->bindValue(':sex_male', SEX_MALE);
	$stmt->execute();
	
	$row = $stmt->fetch();
	if (empty($row)) {
		throw new ExceptionNoResults();
	}
	
	return $row;
}

/**
 * Wyciąga z bazy (z widoku rankingu) aktualny ranking użytkowników, omijając użytkowników, którzy skasowali swoje
 * konta.
 * @param int $limit Maksymalna ilość użytkowników do zwrócenia.
 * @return array Patrz -> pola widoku *prefix_ranking_without_places* w bazie danych
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getPlayersRank($limit = 50)
{
	global $database_handle, $database_prefix;
	
	$limit = intval($limit);
	
	/*
	$query = 'SELECT id_user, login, SUM(score) AS scores_sum
				FROM '.$database_prefix.'_scores
		   LEFT JOIN '.$database_prefix.'_users
				  ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
			GROUP BY '.$database_prefix.'_scores.id_user
			ORDER BY scores_sum DESC
	';
	*/
	$query = 'SELECT *,
                   COUNT(*) AS number_of_rows
              FROM '.$database_prefix.'_ranking_without_places
             LIMIT '.$limit.'
  ';
	RunQuery($query, false, $statement);
	
	$table = $statement->fetchAll();
	
	if (count($table) == 0) {
		throw new ExceptionNoResults();
	}
	
	$table = array_filter($table, function ($element) {
		return $element['login'] != ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT;
	});
	
	return $table;
}

/**
 * Wyciąga z bazy listę użytkowników, którzy są aktualnie online.
 * @return array Zwraca tablicę użytkowników online. Każdy rekord posiada następujące pola:<br />
 * id_user - liczbowy identyfikator użytkownika w bazie danych i serwisie<br />
 * login - login użytkownika<br />
 * sex - płeć użytkownika<br />
 * won - ilość wygranych rozgrywek<br />
 * lost - ilość przegranych rozgrywek<br />
 * plays_count - ilość wszystkich rozgrywek<br />
 * scores_sum - liczba punktów, jakie posiada użytkownik<br />
 * last_seen - data ostatnich odwiedzin serwisu przez użytkownika<br />
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getPlayersWhoAreOnline()
{
	global $database_handle, $database_prefix, $player_active_state_time_period;
	
	
	$query = 'SELECT '.$database_prefix.'_ranking_without_places.id AS id_user,
                   '.$database_prefix.'_ranking_without_places.login,
                   '.$database_prefix.'_ranking_without_places.sex,
                   won,
                   lost,
                   plays_count,
                   scores_sum,
                   last_seen,
                   '.$database_prefix.'_users.logged_in AS is_online /* (SELECT date_last_visit > DATE_SUB(NOW(),INTERVAL '.$player_active_state_time_period.' MINUTE)) AS is_online */
              FROM '.$database_prefix.'_ranking_without_places
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_ranking_without_places.id
             WHERE '.$database_prefix.'_users.logged_in = true
          LIMIT 100
  ';
	$stmt = $database_handle->prepare($query);
	$stmt->execute();
	return $stmt->fetchAll();
}


/**
 * Wyświetla tabelę użytkowników, którzy są aktualnie online korzystając z funkcji getPlayersWhoAreOnline().
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function DisplayOnlineUsersList()
{
	global $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$online_users = getPlayersWhoAreOnline();
	
	echo('<div id="friend_users">');
	foreach ($online_users as $row) {
		if ($row['login'] == '') {
			$row['login'] = 'Konto usunięte';
		}
		if ($row['id_user'] == $_SESSION['id']) {
			continue;
		}
		
		if ($row['sex'] == SEX_FEMALE) {
			$img_sex = '<img src="'.$directory['design'].'icon_female.png" alt="Kobieta" title="Kobieta" />';
		} else {
			$img_sex = '<img src="'.$directory['design'].'icon_male.png" alt="Mężczyzna" title="Mężczyzna" />';
		}
		
		echo($path['profile'].'-'.$row['login'].'">
      <span class="signature">'.$img_sex.' '.$row['login'].'</span>
      <div class="statistics">Wygrane: '.intval($row['won']).' | Przegrane: '.intval($row['lost']).' | Rozgrywki: '.intval($row['plays_count']).' </div>

      <a href="#" class="button_normal small inviteToGameplay" data-id_invited_user="'.$row['id_user'].'" data-login_invited_user="'.$row['login'].'" data-token="'.$_SESSION['token'].'">Zaproś do gry</a>

      <a href="'.$path['conversation'].'-'.$row['login'].'" class="button_normal small">Porozmawiaj</a>

    </div>
    ');
	}
	echo('</div>');
	
}


/**
 * Aktualizuje informacje o dostępności użytkowników, wylogowuje tych, którzy pozostają nieaktywni dłużej niż czas
 * określony w zmiennej $player_active_state_time_period (w minutach). Dodaje do dziennika informację o prawidłowo
 * przeprowadzonej czynności aktualizacji statusów.
 * @throws ExceptionSQL
 */
function changeUsersOnlineStatus()
{
	global $database_handle, $database_prefix, $player_active_state_time_period;
	
	// Users which have activity in the past 15 minutes, are labeling as Online Users
	/*
	$query = 'UPDATE '.$database_prefix.'_users
				 SET logged_in = true
			   WHERE date_last_visit > DATE_SUB(NOW(),INTERVAL '.$player_active_state_time_period.' MINUTE)
	';
	$result = RunQuery($query);
	*/
	
	// Users which doesn't have activity in the past 15 minutes, are labeling as Offline Users
	$query = 'UPDATE '.$database_prefix.'_users
               SET logged_in = false
             WHERE date_last_visit < DATE_SUB(NOW(),INTERVAL '.$player_active_state_time_period.' MINUTE)
  ';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	DailyAdd('Wykonano masową zmianę statusu aktywności użytkowników (zadanie powinno być wykonywane cyklicznie).');
}


/**
 * Wyciąga z bazy listę zaproszeń skierowanych do aktualnie zalogowanego użytkownika. Jesli użytkownik nie jest
 * zalogowany, zgłaszany jest wyjątek o braku uprawnień.
 * @param bool $onlyNotRead Jeśli True, wciąga jedynie te nieprzeczytane wiadomości.
 * @param bool $setAsRead   Jeśli True, oznacza wyciągnięte wiadomości jako "przeczytane".
 * @return array Zwraca tablicę zaproszeń z następującymi polami:<br />
 *                          id_invitation - identyfikator zaproszenia<br />
 *                          id_sender - identyfikator nadawcy zaproszenia<br />
 *                          id_invited_user - identyfikator odbiorcy zaproszenia<br />
 *                          room_name - nazwa pokoju/stołu do które został zaproszony użytkownik<br />
 *                          zone_name - nazwa strefy/gry do której został zaproszony uytkownik<br />
 *                          is_read - Jeśli True, zaproszenie zostało już odczytane. Jesli False, zaproszenie nie
 *                          zostało odczytane.<br /> date - data wysłania zaproszenia<br /> id_category - identyfikator
 *                          kategorii w której znajduje się gra będąca tematem zaproszenia<br /> id_game -
 *                          identyfikator gry do której zaprasza nadawca<br /> is_sender_user_online - informacja czy
 *                          nadawca zaproszenia jest dostępny online<br />
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getInvitationsList($onlyNotRead = true, $setAsRead = false)
{
	global $database_handle, $database_prefix, $player_active_state_time_period;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied('Nie masz wystarczających uprawnień aby pobrać zaproszenia do gry.');
	}
	
	if ($onlyNotRead) {
		$SQL_only_not_read = ' '.$database_prefix.'_invitations.is_read = 0 ';
	} else {
		$SQL_only_not_read = ' 1=1 ';
	}
	
	$setAsRead = $setAsRead ? true : false;
	
	$query = 'SELECT '.$database_prefix.'_invitations.id AS id_invitation,
                   '.$database_prefix.'_invitations.id_sender,
                   '.$database_prefix.'_users.login AS login_sender,
                   '.$database_prefix.'_invitations.id_invited_user,
                   '.$database_prefix.'_invitations.room_name,
                   '.$database_prefix.'_invitations.zone_name,
                   '.$database_prefix.'_invitations.is_read,
                   '.$database_prefix.'_invitations.date,
                   '.$database_prefix.'_games.id_category,
                   '.$database_prefix.'_games.id AS id_game,
                   '.$database_prefix.'_users.logged_in AS is_sender_user_online /* (SELECT date_last_visit > DATE_SUB(NOW(),INTERVAL '.$player_active_state_time_period.' MINUTE)) AS is_online */
              FROM '.$database_prefix.'_invitations
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_invitations.id_sender
         LEFT JOIN '.$database_prefix.'_games
                ON '.$database_prefix.'_games.zone_name = '.$database_prefix.'_invitations.zone_name
             WHERE '.$SQL_only_not_read.'
               AND '.$database_prefix.'_invitations.id_invited_user = :id_invited_user
          ORDER BY '.$database_prefix.'_invitations.date DESC, '.$database_prefix.'_users.logged_in DESC /* date_last_visit > DATE_SUB(NOW(),INTERVAL '.$player_active_state_time_period.' MINUTE) DESC */
          LIMIT 10
    ';
	$stmt = $database_handle->prepare($query);
	$stmt->bindValue(':id_invited_user', $_SESSION['id']);
	$stmt->execute();
	
	$results = $stmt->fetchAll();
	
	if (count($results) == 0) {
		throw new ExceptionNoResults('Na razie brak zaproszeń do gry.');
	}
	
	array_map(function ($element) {
		$element['translatedZoneName'] = translateZoneNameToGameName($element['zone_name']);
		return $element;
	}, $results);
	
	
	if ($setAsRead) {
		// Setting invitations as read
		$query = 'UPDATE LOW_PRIORITY '.$database_prefix.'_invitations
                     SET is_read = 1
                   WHERE '.$database_prefix.'_invitations.id_invited_user = :id_invited_user
	    ';
		$stmt = $database_handle->prepare($query);
		$stmt->bindValue(':id_invited_user', $_SESSION['id']);
		$stmt->execute();
	}
	
	return $results;
}

/**
 * Oznacza zaproszenie o określonym identyfikatorze jako przeczytane.
 * @param $id_invitation Identyfikator zaproszenia.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function setInvitationAsRead($id_invitation)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied('Nie masz wystarczających uprawnień aby pobrać zaproszenia do gry.');
	}
	
	$id_invitation = intval($id_invitation);
	
	// Setting invitations as read
	$query = 'UPDATE '.$database_prefix.'_invitations
                 SET is_read = 1
               WHERE '.$database_prefix.'_invitations.id_invited_user = '.$_SESSION['id'].'
                 AND id = '.$id_invitation.'
	    ';
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
}

/**
 * Przekształca nazwę strefy na nazwę gry. Może być wykorzystane do internacjonalizacji.
 * @param $zoneName Nazwa strefy do przetłumaczenia.
 * @return string Nazwa gry odpowiadająca nazwie strefy.
 */
function translateZoneNameToGameName($zoneName)
{
	switch ($zoneName) {
		case "Gomoku":
			return "Gomoku";
		case "Checkers":
			return "Warcaby";
		default:
			return $zoneName;
	}
}

/**
 * Wyciąga informacje o użytkowniku o podanym loginie z bazy danych. Korzysta z funkcji getUserDataFromId(). Posiadając
 * identyfikat użytkownika, lepiej korzystać z funkcji getUserDataFromId()
 * @param $login Login użytkownika, którego chcemy poznać bliżej.
 * @return array Tablica informacji o użytkowniku.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @throws ExceptionTooMuchResults
 */
function getUserDataFromLogin($login)
{
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$login = addslashes(htmlspecialchars($login));
	$login = str_replace(['_', '%'], '', $login);
	if ($login == '') {
		$login = $_SESSION['login'];
	}
	
	$id_user = ZwrocIdKonta($login);
	if ($id_user <= 0) {
		throw new ExceptionInvalidData();
	}
	
	return getUserDataFromId($id_user);
}

/**
 * Wyciąga informacje o użytkowniku o określonym identyfikatorze.
 * @param $id_user Identyfikator użytkownika o którym informacje chcemy uzyskać.
 * @return array Tablica informacji o użytkowniku.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getUserDataFromId($id_user)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_user = intval($id_user);
	
	if ($id_user <= 0) {
		throw new ExceptionInvalidData();
	}
	
	/* Zamiast tego zapytania, mamy teraz stworzony widok, korzystający z innych widoków, który zastępuje poniższe zapytanie: */
	/*
	$query = 'SELECT *,
					 (
					  SELECT tab_wins.wins FROM (SELECT SUM(score>0) AS wins, id_user FROM '.$database_prefix.'_scores WHERE id_user='.$id_user.' GROUP BY id_user) AS tab_wins
					 ) AS win_count,
					 (
					  SELECT tab_loss.loss FROM (SELECT SUM(score<0) AS loss, id_user FROM '.$database_prefix.'_scores WHERE id_user='.$id_user.' GROUP BY id_user) AS tab_loss
					 ) AS loss_count,
					 (
					  SELECT tab_plays.plays_count FROM (SELECT COUNT(score) AS plays_count, id_user FROM '.$database_prefix.'_scores WHERE id_user='.$id_user.' GROUP BY id_user) AS tab_plays
					 ) AS plays_count,
					 login,
					 name,
					 surname,
					 sex,
					 email,
					 date_register
  
				FROM (
					   SELECT @i:=@i+1 AS ranking_pos, tab.* FROM (
						SELECT prefix_users.id,
							   login,
							   email,
							   sex,
							   name,
							   surname,
							   SUM(score) AS scores_sum,
							   TIME_TO_SEC(TIMEDIFF(NOW(),date_last_visit)) AS last_seen,
							   DATE(date_register) AS date_register
						  FROM '.$database_prefix.'_users
					 LEFT JOIN '.$database_prefix.'_scores
							ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
					  GROUP BY '.$database_prefix.'_users.id
					  ORDER BY scores_sum DESC
							) AS tab
					 ) AS ranking_list
			   WHERE ranking_list.login LIKE "'.$login.'"
	';
	*/
	$query = 'SELECT *
              FROM (
                     SELECT @i:=@i+1 AS ranking_pos,
                            '.$database_prefix.'_ranking_without_places.*
                       FROM '.$database_prefix.'_ranking_without_places
                       JOIN (SELECT @i:=0) AS temp2 /* Its workaround to not execute two queries (one for initialise @i variable and second for true query) */
                   ) AS temp
             WHERE temp.id = '.$id_user;
	
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	return FetchQuery($statement);
}


/**
 * Funkcja testująca, służąca do mierzenia czasu wykonywania kodu (należy ją wywołać przed i po danym bloku kodu
 * którego czas wykonania chcemy zmierzyć, a następnie wyświetlić różnicę czasu drugiego i pierwszego.
 * @return Zwraca dokładny czas.
 */
function Timer()
{
	$czas = explode(" ", microtime());
	$a = (double)$czas[0];
	$b = (double)$czas[1];
	return $a + $b;
}


/**
 * Wysyła zapytanie do wykonania w bazie danych i zwraca wynik.
 * @param      $query
 * @param bool $czekaj_na_zakonczenie
 * @return resource
 */
function RunQuery($query, $czekaj_na_zakonczenie = true, &$statement = null)
{
	global $database_handle, $query_counter, $zap, $production_mode;
	$query_counter++;
	
	if ($czekaj_na_zakonczenie) {
		$statement = $database_handle->prepare($query);
		$statement->execute();
		$result = $statement->fetch();
	} else {
		$database_handle->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
		$statement = $database_handle->prepare($query);
		$statement->execute();
		$result = null;
		$database_handle->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
	}
	
	//if (!$production_mode) { if (!$result) { echo(mysql_error()); /*print_r(debug_backtrace());*/ } }
	return $result;
}

function FetchQuery($statement)
{
	return $statement->fetch(PDO::FETCH_ASSOC);
}

function NumQueryRows($statement)
{
	return $statement->rowCount();
}


/**
 * Funkcja zapisuje w pliku z logami adres IP internauty odwiedzjącego portal
 * @global
 * @see WypiszOstatnieAdresyIP
 */
function ZapiszAdresIPInternauty()
{
	global $path;
	// Usuwanie logów, jeśli plik przekroczy 1MB
	if (file_exists($path['log_IP'])) {
		if ((@filesize($path['log_IP'])) > (1024 * 1024)) {
			unlink($path['log_IP']);
		}
	}
	// Loging numerów IP
	if (file_exists($path['log_IP'])) {
		$database_handle = fopen($path['log_IP'], "ab");
	} else {
		$database_handle = fopen($path['log_IP'], "w");
	}
	fwrite($database_handle, "O godzinie ".date("H:i:s").", dnia ".date("j-m-y").", IP:");
	// Wykrywanie prawdziwego adresu IP (jeśli użytkownik jest za prox'y)
	if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
		fwrite($database_handle, $_SERVER['HTTP_X_FORWARDED_FOR']." (za serwerem prox'y)");
	} else {
		fwrite($database_handle, $_SERVER['REMOTE_ADDR']."");
	}
	fwrite($database_handle, " [przeglądarka: ".$_SERVER['HTTP_USER_AGENT']."]\r\n");
	fclose($database_handle);
}

/**
 * Funkcja wypisuje ostatnie adresy IP użytkowników którzy ostatnio odwiedzili portal. Działa tylko z uprawnieniami
 * administracyjnymi.<br />
 * // Tylko z uprawnieniami administratora
 * @param $ile_adresow Maksymalna ilość adresów które mają zostać wyświetlone.
 * @return bool
 * @see ZapiszAdresIPInternauty
 * @global
 */
function WypiszOstatnieAdresyIP($ile_adresow)
{
	global $path;
	if ($_SESSION['account_type'] <= USER) {
		return false;
	}
	
	$linie = file($path['log_IP']);
	echo("<ol>");
	
	if ((count($linie) - $ile_adresow) < 0) {
		$od = 0;
	} else {
		$od = (count($linie) - $ile_adresow);
	}
	
	for ($i = count($linie) - 1; $i >= $od; $i--) {
		echo("<li>".htmlspecialchars(addslashes($linie[$i]))."</li>\n");
	}
	echo("</ol>");
	DailyAdd('Wykonano listing ostatnich adresów IP gości.', LEVEL_INF);
}

/**
 * Wysyła wiadomość e-mail o podanej treści do wszystkich użytkowników serwisu.
 * @param $temat            Temat wiadomości.
 * @param $message          Treść wiadomości.
 * @param $podpis           Podpis nadawcy.
 * @param $kolor_tekstu     Kolor tekstu jako HEX.
 * @param $kolor_tla        Kolor tła jako HEX.
 * @param $rozmiar_czcionki Rozmiar czcionki
 * @return bool Zwraca True jeśli wysyłanie się powiodło i False w przeciwnym wypadku.
 */
function WyslijMejlDoWszystkichUzytkownikow(
	$temat,
	$message,
	$podpis,
	$kolor_tekstu,
	$kolor_lacze,
	$kolor_lacze_odwiedzone,
	$kolor_lacze_aktywne,
	$kolor_tla,
	$rozmiar_czcionki
) {
	global $database_handle, $database_prefix, $path, $kontakt_email, $service_name;
	
	$temat = htmlspecialchars($temat);
	$message = nl2br(htmlspecialchars($message));
	$podpis = htmlspecialchars($podpis);
	$kolor_tekstu = FiltrujKolor($kolor_tekstu, '#000000');
	$kolor_tla = FiltrujKolor($kolor_tla, '#DFE3EA');
	$kolor_lacze = FiltrujKolor($kolor_lacze, '#FF9966');
	$kolor_lacze_odwiedzone = FiltrujKolor($kolor_lacze_odwiedzone, '#FF9900');
	$kolor_lacze_aktywne = FiltrujKolor($kolor_lacze_aktywne, '#6699CC');
	
	$rozmiar_czcionki = intval($rozmiar_czcionki);
	$OK = true;
	
	$mejl =
		'<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">
      <HTML>
      <HEAD>
      <META http-equiv=Content-Type content="text/html; charset=UTF-8">
      <STYLE>
            body { width:100%; background-color: '.$kolor_tla.'; text:'.$kolor_tekstu.'; color:'.$kolor_tekstu.'; font-family: Tahoma, sans-serif; font-size: '.$rozmiar_czcionki.'pt; }
        a:link { color: '.$kolor_lacze.' }
        a:visited { color: '.$kolor_lacze_odwiedzone.' }
        a:hover { color: '.$kolor_lacze_aktywne.' }
        .tresc { width: 90%; margin: 15pt; }
      </STYLE>
      </HEAD>
      <BODY>

    <div class="tresc">

      '.$message.'

      <br /><br />
    <address>
    '.$podpis.'
    </address>

      </div>


      </BODY>
      </HTML>';
	
	$additional_headers = 'From: '.$service_name.' <'.$kontakt_email.'>'."\r\n";
	$additional_headers .= 'MIME-Version: 1.0'."\r\n";
	$additional_headers .= 'Content-type: text/html; charset=UTF-8'."\r\n";
	
	$query = "SELECT id,email FROM ".$database_prefix."_users WHERE account_type<".ADMINISTRATOR;
	$statement = null;
	RunQuery($query, false, $statement);
	$licznik_wyslanych = 0;
	$licznik_blednych = 0;
	
	set_time_limit($statement->rowCount() * 5); // wysyłanie średnio 1 mejl na 5 sekund
	while ($row = FetchQuery($statement)) {
		if (!mail($row['email'], $temat, $mejl, $additional_headers)) {
			echo('<div class="negative">Nie udało się wysłać wiadomości do <a href="'.$path['profile'].'?id_uzytkownika='.$row['id'].'">użytkownika o ID = '.$row['id'].'</a></div>');
			$licznik_blednych++;
		} else {
			$licznik_wyslanych++;
		}
	}
	set_time_limit(120);
	WyswietlPanelStart('Podsumowanie');
	echo('Ilość wszystkich wiadomości do wysłania: '.($licznik_blednych + $licznik_wyslanych)."<br />\r\n");
	echo('Wiadomości wysłanych: '.$licznik_wyslanych."<br />\r\n");
	echo('Wiadomości niewysłanych (błędów): '.$licznik_blednych."<br />\r\n");
	WyswietlPanelEnd();
	
	DailyAdd('Użytkownik o ID='.$_SESSION['id_account'].' wykonał mailing do wszystkich użytkowników (ilość wysłanych wiadomości: '.$licznik_wyslanych.', ilość błędnych: '.$licznik_blednych.').',
		LEVEL_EVENT);
	return $OK;
}


/**
 * Testuje ciąg podany jako parametr na zwartość niedozwolonych znaków (patrz wartość zwracana).
 * @param $tekst
 * @return bool Zwraca true gdy znajdzie znaki inne niż a-z, 0-9, spacja, polskie znaki diakrytyczne, znaki specjalne
 *              !@#\^&*.()_-+ (nie jest czuły na wielkość liter)
 */
function CzyZnakiNiedozwolone($tekst)
{
	$wynik = preg_match('/[^a-z0-9ąęśćżźółń!@#\\.\\^&\\*\\(\\)_ \-\\+]/i', $tekst);
	return ($wynik == 1);
}

/**
 * Testuje ciąg podany jako parametr i zwraca True jeśli parametr zawiera jedynie litery lub cyfry lub podkreślenie.
 * @param $tekst
 * @return bool
 */
function CzyTylkoLiteryCyfryIPodkreslenie($tekst)
{
	$wynik = preg_match('/[^a-z0-9ąęśćżźółń_]/i', $tekst);
	return ($wynik != 1);
}

/**
 * Testuje ciąg podany jako parametr i zwraca True jeśli parametr zawiera jedynie litery lub cyfry.
 * @param $tekst
 * @return bool
 */
function CzyTylkoLiteryCyfry($tekst)
{
	$wynik = preg_match('/[^a-z0-9ąęśćżźółń]/i', $tekst);
	return ($wynik != 1);
}

/**
 * Przelicza cenę netto na brutto uwzględniając podatek.
 * @param $cena_netto
 * @return float
 */
function PrzeliczCeneNettoNaBrutto($cena_netto)
{
	$cena_netto = floatval($cena_netto);
	// TODO Przenieść ten literał do zmiennych globalnych.
	return $cena_netto * 1.23;
}

/**
 * Testuje adres IP podany jako parametr, sprawdzając jego poprawność syntaktyczną.
 * @param $IP
 * @return bool
 */
function SprawdzCzyPoprawnyAdresIP($IP)
{
	if (preg_match("^([1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3}^",
		$IP)) {
		return true;
	} else {
		return false;
	}
}

/**
 * Testuje adres e-mail podany jako parametr, sprawdzając jego poprawność syntaktyczną.
 * @param $email
 * @return bool
 */
function isEmailFormatValid($email)
{
	$ok = preg_match('/^[_a-z0-9-]+(\.[_a-z0-9-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,4})$/i', $email);
	return ($ok == 1);
}


/**
 * Zamienia litery takie jak Ą lub Ę na ich odpowiedniki bez "ogonków": A lub E.
 * @param $tekst
 * @return mixed
 */
function UsunPolskieOgonki($tekst)
{
	return preg_replace(array(
		'/Ą/',
		'/Ć/',
		'/Ę/',
		'/Ł/',
		'/Ń/',
		'/Ó/',
		'/Ś/',
		'/Ż/',
		'/Ź/',
		'/ą/',
		'/ć/',
		'/ę/',
		'/ł/',
		'/ń/',
		'/ó/',
		'/ś/',
		'/ż/',
		'/ź/'
	),
		array('A', 'C', 'E', 'L', 'N', 'O', 'S', 'Z', 'Z', 'a', 'c', 'e', 'l', 'n', 'o', 's', 'z', 'z'),
		$tekst);
}

/**
 * Usuwa spację z tekstu podanego jako parametr.
 * @param $tekst
 * @return mixed
 */
function UsunSpacje($tekst)
{
	return str_replace(' ', '', $tekst);
}

/**
 * Zamienia wszystkie spacje w tekście podanym jako parametr na znaki podkreślenia.
 * @param $tekst
 * @return mixed
 */
function SpacjeNaPodkreslenie($tekst)
{
	return str_replace(' ', '_', $tekst);
}

/**
 * Wykonuje operacje na adresie URL obcinając przedrostek HTTP, przedrostek WWW lub ukośnik na końcu.
 * @param      $adres
 * @param bool $obetnij_http
 * @param bool $obetnij_www
 * @param bool $bez_ukosnika_na_koncu
 * @return mixed|string
 */
function ObetnijAdres($adres, $obetnij_http = true, $obetnij_www = false, $bez_ukosnika_na_koncu = false)
{
	$ilosc = 1;
	
	if ($obetnij_http) {
		$adres = str_replace('http://', '', $adres, $ilosc);
	}
	
	if ($obetnij_www) {
		$adres = str_replace('www.', '', $adres, $ilosc);
	}
	
	if ($bez_ukosnika_na_koncu) {
		if ($adres[strlen($adres) - 1] == '/') {
			$adres = mb_substr($adres, 0, strlen($adres) - 1);
		}
	}
	
	return $adres;
}

/**
 * Skraca tekst do podanej jako parametr ilości znaków dodając na końcu trzykropek.
 * @param $komentarz
 * @param $ile_znakow
 * @return string
 */
function SkrocTekst($komentarz, $ile_znakow)
{
	$ilosc = strlen($komentarz);
	
	if ($ilosc >= $ile_znakow) {
		$tnij = mb_substr($komentarz, 0, max($ile_znakow, 0));
		$skroconykomentarz = $tnij.'...';
	} else {
		$skroconykomentarz = $komentarz;
	}
	return htmlspecialchars(htmlspecialchars_decode($skroconykomentarz));
}

/**
 * Usuwa znaczniki BBCode z tekstu podanego jako parametr.
 * @param $tekst
 * @return mixed
 */
function UsunBBCode($tekst)
{
	return preg_replace('(\[.+?\])', '', $tekst);
}

/** Funkcja narzędziowa - tłumaczy numer dnia na nazwę dnia tygodnia, dodaje również przedrostek
 * @param numer_dnia
 * @param $dodaj_przedrostek
 */
function PrzetlumaczNumerDniaNaNazwe($numer_dnia, $dodaj_przedrostek = false)
{
	$numer_dnia = intval($numer_dnia);
	switch ($numer_dnia) {
		case 0:
			return ($dodaj_przedrostek ? 'w niedzielę' : 'niedziela');
		case 1:
			return ($dodaj_przedrostek ? 'w poniedziałek' : 'poniedziałek');
		case 2:
			return ($dodaj_przedrostek ? 'we wtorek' : 'wtorek');
		case 3:
			return ($dodaj_przedrostek ? 'we środę' : 'środa');
		case 4:
			return ($dodaj_przedrostek ? 'we czwartek' : 'czwartek');
		case 5:
			return ($dodaj_przedrostek ? 'w piątek' : 'piątek');
		case 6:
			return ($dodaj_przedrostek ? 'w sobotę' : 'sobota');
		default:
			'';
	}
}


/**
 * Ta bardzo pożyteczna funkcja formatuje treść artykułów automatycznie zamieniając odnośniki zawarte w tekście na
 * klikalne łącza. Jesli parametr $wykrywaj_URL jest ustawiony na true, funkcja wyszukuje i zamienia na linki ciągi
 * odpowiadajace adresom URL, pomimo tego, że nawet nie zostały one objęte poprzez BBCode
 * @param      $tekst
 * @param bool $wykrywaj_URL
 * @return string
 */
function FormatujTekst($tekst, $wykrywaj_URL = false)
{
	global $directory;
	
	$tekst = stripslashes($tekst);
	
	if ($wykrywaj_URL) {
		$tekst = eregi_replace('\\\\&quot;', '&quot;', $tekst);
		// convert support@pogoda.in into
		// <a href="mailto:support@pogoda.in">
		// support@pogoda.in</a>
		$tekst = eregi_replace('[-a-z0-9!#$%&\'*+/=?^,\._`{|}~]+@([.]?[a-zA-Z0-9_/-])*', '<a href="mailto:\\0">\\0</a>',
			$tekst);
		
		// convert http://www.pogoda.in/new_york/eng/ into
		// <a href="http://pogoda.in/new_york/eng/">
		// pogoda.in/new_york/eng/</a>
		$tekst = eregi_replace('[a-zA-Z]+://(([.]?[a-zA-Z0-9_ęóąśłżźćń,()\./-])*)', '<a href="\\0">\\1</a>', $tekst);
		
		// convert www.pogoda.in/new_york/eng/ into
		// <a href="http://www.pogoda.in/new_york/eng/">
		// www.pogoda.in/new_york/eng/</a>
		$tekst = eregi_replace('(^| )(www([-]*[.]?[a-zA-Z0-9_ęóąśłżźćń,()\./-?&%])*)', ' <a href="http://\\2">\\2</a>',
			$tekst);
	}
	
	// Wyszukiwanie BBCode odpowiedzialnych za:
	
	// wyświetlanie "buziek"
	$tekst = eregi_replace('(\[\:([a-zA-Z0-9]+)\:\])',
		'<img src="'.$directory['emoticons'].'\\2.gif" style="vertical-align:middle;" alt="emotikona" />', $tekst);
	$tekst = preg_replace(array(
		'(\s;-\))',
		'(\s;\))',
		'(\s\:-\))',
		'(\s\:\))',
		'(\s\:-\*)',
		'(\s\:\*)',
		'(\s\:P)',
		'(\s;P)',
		'(\s\:-P)',
		'(\s\;-P)',
		'(\s\:-D)',
		'(\s\:D)',
		'(\s\;-D)',
		'(\s\;D)'
	),
		array(
			' <img src="'.$directory['emoticons'].'oczko.gif" alt=";-)" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'oczko.gif" alt=";)" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'usmiech.gif" alt=":-\" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'usmiech.gif" alt=":)" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'buziak.gif" alt=":-*" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'buziak.gif" alt=":*" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'p.gif" alt=":P" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'p.gif" alt=";P" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'p.gif" alt=":-P" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'p.gif" alt=";-P" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'D.gif" alt=":-D" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'D.gif" alt=":D" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'D.gif" alt=";-D" style="vertical-align:middle;" />',
			' <img src="'.$directory['emoticons'].'D.gif" alt=";D" style="vertical-align:middle;" />'
		),
		$tekst);
	
	// akapit
	$tekst = preg_replace('(\[p\](.+?)\[/p\])', '<p>\\1</p>', $tekst);
	
	// pogrubianie tekstu
	$tekst = preg_replace('(\[b\](.+?)\[/b\])', '<b>\\1</b>', $tekst);
	// pochylanie tekstu
	$tekst = preg_replace('(\[i\](.+?)\[/i\])', '<i>\\1</i>', $tekst);
	// podkreślanie tekstu
	$tekst = preg_replace('(\[u\](.+?)\[/u\])', '<span style="text-decoration:underline">\\1</span>', $tekst);
	
	// zmiana wielkości czcionki
	$tekst = preg_replace('(\[size=\s{0,1}(smaller|xx-small|x-small|small|medium|larger|large|x-large|xx-large)\](.+?)\[/size\])',
		'<span style="font-size:\\1;">\\2</span>', $tekst);
	
	// cytat blokowy
	$tekst = preg_replace('(\[blockquote\](.+?)\[/blockquote\])', '<blockquote>\\1</blockquote>', $tekst);
	
	// obrazek
	$tekst = preg_replace('(\[img=(.+?)\](.+?)\[/img\])', '<img src="\\1" alt="\\2" title="\\2" />', $tekst);
	
	// hiperłącze
	$tekst = preg_replace('(\[url=(.+?)\](.+?)\[/url\])', '<a href="\\1">\\2</a>', $tekst);
	
	return nl2br($tekst);
}

/**
 * Tworzy nowe konto użytkownika w serwisie.
 * @param      $login
 * @param      $email
 * @param      $password
 * @param      $password_confirm
 * @param      $sex
 * @param bool $activate
 * @throws ExceptionEmailAlreadyExists
 * @throws ExceptionEmailCantBeEmpty
 * @throws ExceptionEmailFormatInvalid
 * @throws ExceptionEmailSend
 * @throws ExceptionInvalidData
 * @throws ExceptionLoginCantBeEmpty
 * @throws ExceptionLoginFormatInvalid
 * @throws ExceptionPasswordCantBeEmpty
 * @throws ExceptionPasswordTooShort
 * @throws ExceptionPasswordsDoesntMatch
 * @throws ExceptionSQL
 */
function CreateAccount($login, $email, $password, $password_confirm, $sex, $activate = false)
{
	global $database_handle, $database_prefix, $database_handle, $seed_private;
	
	$login = addslashes(htmlspecialchars($login));
	$email = addslashes(htmlspecialchars($email));
	$password = addslashes(htmlspecialchars($password));
	$password_confirm = addslashes(htmlspecialchars($password_confirm));
	$sex = intval($sex);
	$activate = $activate ? true : false;
	
	if ($password != $password_confirm) {
		throw new ExceptionPasswordsDoesntMatch();
	}
	if (strlen($password) < 6) {
		throw new ExceptionPasswordTooShort();
	}
	$password = sha1($seed_private.$password);
	
	if ($login == '') {
		throw new ExceptionLoginCantBeEmpty();
	}
	if (!CzyTylkoLiteryCyfry($login)) {
		throw new ExceptionLoginFormatInvalid();
	}
	if ($email == '') {
		throw new ExceptionEmailCantBeEmpty();
	}
	if (!isEmailFormatValid($email)) {
		throw new ExceptionEmailFormatInvalid();
	}
	if ($password == '') {
		throw new ExceptionPasswordCantBeEmpty();
	}
	
	$activation_code = rand(1, getrandmax());
	
	$query = 'INSERT INTO '.$database_prefix.'_users
                        SET login="'.$login.'",
                            password="'.$password.'",
                            email="'.$email.'",
                            active='.($activate ? 'true' : 'false').',
                            sex="'.$sex.'",
                            IP="'.addslashes($_SERVER['REMOTE_ADDR']).'",
                            date_register = CURRENT_TIMESTAMP(),
                            activation_code="'.$activation_code.'"';
	$result = RunQuery($query);
	
	if (mysql_errno() == 1062) {
		throw new ExceptionEmailAlreadyExists();
	}
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	if (!$activate) {
		SendActivateMailToUserWithId(mysql_insert_id($database_handle));
	}
}

// TODO: Check security
/**
 * Tworzy nowe konto użytkownika w serwisie z danych zwrotnych dostarczonych przez Facebook.
 * @param      $id_facebook
 * @param      $email
 * @param      $firstName
 * @param      $lastName
 * @param      $sex
 * @param bool $activate
 * @throws
 * @throws ExceptionEmailCantBeEmpty
 * @throws ExceptionEmailFormatInvalid
 * @throws ExceptionEmailSend
 * @throws ExceptionInvalidData
 * @throws ExceptionSQL
 * @throws ExceptionTooMuchResults
 * @throws ExceptionUnexpected
 */
function CreateAccountFromFacebook($id_facebook, $email, $firstName, $lastName, $sex, $activate = false)
{
	global $database_handle, $database_prefix, $database_handle, $seed_private;
	
	$id_facebook = addslashes(htmlspecialchars($id_facebook));
	$email = addslashes(htmlspecialchars($email));
	$firstName = addslashes(htmlspecialchars($firstName));
	$lastName = addslashes(htmlspecialchars($lastName));
	$sex = intval($sex);
	$activate = $activate ? true : false;
	
	if (intval($id_facebook) < 1000) {
		throw new ExceptionInvalidData();
	}
	if ($firstName == '') {
		throw new ExceptionInvalidData();
	}
	if ($lastName == '') {
		throw new ExceptionInvalidData();
	}
	if ($email == '') {
		throw new ExceptionEmailCantBeEmpty();
	}
	if (!isEmailFormatValid($email)) {
		throw new ExceptionEmailFormatInvalid();
	}
	
	try {
		ZwrocIdKontaOEmail($email);
	} catch (ExceptionNoResults $e) {
		$login = generateFreeLoginFromName($firstName, $lastName);
		
		$activation_code = rand(1, getrandmax());
		
		$query = 'INSERT INTO '.$database_prefix.'_users
                          SET login="'.$login.'",
                              password=NULL,
                              id_facebook="'.$id_facebook.'",
                              name="'.$firstName.'",
                              surname="'.$lastName.'",
                              email="'.$email.'",
                              active='.($activate ? 'true' : 'false').',
                              sex="'.$sex.'",
                              can_change_login=true,
                              IP="'.addslashes($_SERVER['REMOTE_ADDR']).'",
                              activation_code="'.$activation_code.'"';
		$result = RunQuery($query);
		
		if (mysql_errno() != 1062) { // Jeśli takie konto jeszcze nie istnieje, to
			if (!$activate) // wyślij list aktywacyjny
			{
				SendActivateMailToUserWithId(mysql_insert_id($database_handle));
			}
			if (!$result) {
				throw new ExceptionSQL();
			}
		}
	}
	
	// Logujemy się na nie w trybie wymuszenia logowania facebookowego (bez hasła)
	AuthorizeUser($email, null, true, true);
}

/**
 * Generuje wolny login z imienia i nazwiska podanego jako parametr. Działa do momentu w którym dodane do kombinacji
 * tych parametrów dane utworzą unikalną na skalę serwisu nazwę użytkownika.
 * @param $firstName
 * @param $lastName
 * @return mixed
 * @throws
 */
function generateFreeLoginFromName($firstName, $lastName)
{
	global $database_handle, $database_prefix;
	
	$firstName = addslashes(htmlspecialchars(htmlspecialchars_decode(stripslashes($firstName))));
	$lastName = addslashes(htmlspecialchars(htmlspecialchars_decode(stripslashes($lastName))));
	
	// Filtrowanie niechcianych znaków
	$firstName = str_replace(['_', '%'], '', $firstName);
	$lastName = str_replace(['_', '%'], '', $lastName);
	
	$proposes = array();
	$proposes[] = strtolower($firstName);
	if (strlen($lastName) >= 1) {
		$proposes[] = ucfirst($firstName).ucfirst($lastName[0]);
	}
	if (strlen($firstName) >= 2) {
		$proposes[] = ucfirst($firstName).ucfirst($lastName[0].$lastName[1]);
	}
	
	$generateCount = 15;
	for ($i = 1; $i < $generateCount; $i++) {
		$proposes[] = $firstName.$i;
	}
	
	if (strlen($lastName) >= 1) {
		for ($i = 1; $i < $generateCount; $i++) {
			$proposes[] = $firstName.ucfirst($lastName[0]).$i;
		}
	}
	
	$result = 0;
	$i = 0;
	do {
		$query = 'SELECT login
                FROM '.$database_prefix.'_users
               WHERE login LIKE "'.$proposes[$i].'"';
		$statement = null;
		RunQuery($query, false, $statement);
		$generateCount++;
		$proposes[] = $firstName.$generateCount;
		if (strlen($lastName) >= 1) {
			$proposes[] = ucfirst($firstName).ucfirst($lastName[0]).$generateCount;
		}
		$i++;
	} while (NumQueryRows($statement) > 0); // Wyszukuj dopóki nie znajdziesz wolnego loginu
	
	return $proposes[$i - 1];
}

/**
 * Zmienia hasło do konta o identyfikatorze podanym jako parametr. Sprawdza czy nowe hasło zgadza się ze swoim
 * potwierdzeniem.
 * @param $id_konta
 * @param $stare_haslo
 * @param $nowe_haslo
 * @param $nowe_haslo_potwierdzenie
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidPassword
 * @throws ExceptionPasswordTooShort
 * @throws ExceptionPasswordsAreIdentical
 * @throws ExceptionPasswordsDoesntMatch
 * @throws ExceptionSQL
 */
function AccountChangePassword($id_konta, $stare_haslo, $nowe_haslo, $nowe_haslo_potwierdzenie)
{
	global $database_handle, $database_prefix, $seed_private, $minimal_password_length;
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_konta = intval($id_konta);
	$stare_haslo = addslashes(htmlspecialchars($stare_haslo));
	$nowe_haslo = addslashes(htmlspecialchars($nowe_haslo));
	$nowe_haslo_potwierdzenie = addslashes(htmlspecialchars($nowe_haslo_potwierdzenie));
	
	$stare_haslo = sha1($seed_private.$stare_haslo);
	
	$query = 'SELECT id
                  FROM '.$database_prefix.'_users
            WHERE id = '.$id_konta.'
              AND password = "'.$stare_haslo.'"';
	$statement = null;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) != 1) {
		throw new ExceptionInvalidPassword('Wprowadzone aktualne hasło jest nieprawidłowe.');
	}
	
	if ($nowe_haslo == '') {
		throw new ExceptionPasswordTooShort('Wpisz nowe hasło.');
	}
	if ($nowe_haslo != $nowe_haslo_potwierdzenie) {
		throw new ExceptionPasswordsDoesntMatch();
	}
	if (strlen($nowe_haslo) < $minimal_password_length) {
		throw new ExceptionPasswordTooShort();
	}
	
	$nowe_haslo = sha1($seed_private.$nowe_haslo);
	
	if ($nowe_haslo == $stare_haslo) {
		throw new ExceptionPasswordsAreIdentical('Nowe hasło musi różnić się od obecnego.');
	}
	
	
	$query = 'UPDATE '.$database_prefix.'_users
                  SET password = "'.$nowe_haslo.'"
            WHERE id='.$id_konta.'
              AND password = "'.$stare_haslo.'"
           LIMIT 1';
	$result = RunQuery($query);
	if ($result) {
		DailyAdd('Zmieniono hasło konta '.$id_konta.'.', LEVEL_INF);
		Logout();
	} else {
		DailyAdd('Wystąpił błąd przy próbie zmiany hasła konta '.$id_konta.'.', LEVEL_ERROR);
		throw new ExceptionSQL();
	}
}

/**
 * Aktywuje konto użytkownika o podanym identyfikatorze wykorzystując podany jako parametr kod aktywujący (jest on
 * generowany automatycznie i dostarczanly w e-mailu)
 * @param $id_user         Identyfikator użytkownika w serwisie.
 * @param $activation_code Kod aktywujący dostarczony drogą poczty elektronicznej.
 * @return bool Zwraca True jeśli aktywacja się powiodła i False jeśli się nie powiodła.
 * @throws ExceptionInvalidData
 * @throws ExceptionSQL
 * @throws ExceptionUserAccountIsAlreadyActive
 * @throws ExceptionUserDoesntExists
 */
function ActivateAccount($id_user, $activation_code)
{
	global $database_handle, $database_prefix;
	
	$id_user = intval($id_user);
	$activation_code = intval($activation_code);
	
	$query = 'SELECT id, active
                  FROM '.$database_prefix.'_users
                 WHERE (id = '.$id_user.')';
	$statement = null;
	RunQuery($query, false, $statement);
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionUserDoesntExists();
	}
	$row = FetchQuery($statement);
	if ($row['active'] == 1) {
		throw new ExceptionUserAccountIsAlreadyActive();
	}
	
	$query = 'SELECT id, email, new_email
                  FROM '.$database_prefix.'_users
                 WHERE (id = '.$id_user.')
                   AND (activation_code = "'.$activation_code.'")';
	$statement = null;
	RunQuery($query, false, $statement);
	$row = FetchQuery($statement);
	
	// If activation code doesn't combine with user account with the given ID
	if (NumQueryRows($statement) != 1) {
		throw new ExceptionInvalidData();
	}
	
	if ($row['new_email'] != '') {
		$email = $row['new_email'];
	} else {
		$email = $row['email'];
	}
	
	// Aktywowanie użytkownika (ale tylko wtedy gdy nazwa użytkownika i jego kod aktywujący są poprawne)
	$query = 'UPDATE '.$database_prefix.'_users
                   SET active=1,
                       email = "'.$email.'",
                       new_email = NULL
                 WHERE (id='.$id_user.')
                   AND (activation_code="'.$activation_code.'")';
	$result = RunQuery($query);
	if (!$result) {
		DailyAdd('Niepowodzenie przy próbie aktywacji konta użytkownika o ID='.$id_user.'.', LEVEL_ERROR);
		throw new ExceptionSQL();
	}
	DailyAdd('Próba aktywacji konta użytkownika o ID='.$id_user.'.', LEVEL_EVENT);
	
	return true;
}

/**
 * Deaktywuje konto aktualnie zalogowanego użytkownika.
 * @return bool
 */
function DeActivateAccount()
{
	global $database_handle, $database_prefix, $database_handle;
	
	$query = 'UPDATE '.$database_prefix.'_users
                   SET active=0
                 WHERE id='.$_SESSION['id'];
	$result = RunQuery($query);
	
	if (mysql_affected_rows($database_handle) == 0) {
		return false;
	}
	
	DailyAdd('Próba deaktywacji konta użytkownika o ID='.$_SESSION['id'].'.', LEVEL_EVENT);
	
	return true;
}

/**
 * Funkcja używana przy opcji "Zapomniałem hasła". Generuje nowe hasło i zapisuje je w kolumnie haslo_wygenerowane w
 * bazie danych oraz wysyła mejla z linkiem aktywujacym nowe hasło. Obecne hasło zostaje aktualne do momentu gdy
 * użytkownik nie kliknie w link znajdujący się w wiadomości - wtedy aktualne hasło zostaje zastąpione tym
 * wygenerowanym.
 * @param $email
 * @return bool
 * @throws ExceptionSendingMessage
 */
function AccountSendNewGeneratedPassword($email)
{
	global $database_handle, $database_prefix, $seed_private, $service_name, $email_contact, $service_base_address, $path;
	
	$email = addslashes($email);
	
	$query = 'SELECT id, login, sex, email, activation_code
                  FROM '.$database_prefix.'_users
                 WHERE (email="'.$email.'")';
	
	$OK = true;
	$statement = null;
	RunQuery($query, false, $statement);
	
	$row = FetchQuery($statement);
	if (NumQueryRows($statement) == 1) {
		$new_password = GenerateRandomDigitSerie(8);
		
		$query = 'UPDATE '.$database_prefix.'_users SET password_generated="'.sha1($seed_private.$new_password).'" WHERE (email="'.$email.'")';
		$result = RunQuery($query);
		if ($result) {
			$message =
				'<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">
      <HTML>
      <HEAD>
      <META http-equiv=Content-Type content="text/html; charset=UTF-8">
      <STYLE>
            body { width:100%; background-color: white; text:black; color:black; font-family: Tahoma, sans-serif; }
        a:link { color: #FFCC66 }
        a:visited { color: #FF9900 }
        a:hover { color: #56a262 }
        .tresc { width: 50%; background-color: white; text:black; color:black; }
      </STYLE>
      </HEAD>
      <BODY>

    <div class="tresc">
      <h1>Dzień dobry,</h1>
      <p>dostał'.($row['sex'] == SEX_FEMALE ? 'a' : 'e').'ś ten list ponieważ Ty (lub ktoś znający Twój adres e-mail) poprosił o zmianę hasła dla Twojego konta (opcja przypomnij hasło) w serwisie '.$service_name.' ( <a href="'.$service_base_address.'">'.$service_base_address.'</a> ). Aby skorzystać ze zmiany hasła, aktywuj nowe hasło klikając na poniższy link. Jeśli to nie Ty zażądał'.($row['sex'] == SEX_FEMALE ? 'a' : 'e').'ś zmiany hasła (zrobił to np. ktoś inny znający Twój adres e-mail), po prostu zignoruj tę wiadomość.</p>

      <h3>Dane konta:</h3>
      <pre>
      Adres e-mail: '.stripslashes($row['email']).' <br />
      Login: '.stripslashes($row['login']).' <br />
      Nowe hasło: '.$new_password.'
      </pre>

      <h3>Aktywacja nowego hasła:</h3>
      <pre>
      <a href="'.$service_base_address.$path['remember_password'].'?id_account='.$row['id'].'&activation_code='.$row['activation_code'].'">Kliknij tutaj aby aktywować swoje nowe hasło</a>
      </pre>

      <p>Dziękujemy!</p>
      </div>

      </BODY>
      </HTML>';
			$additional_headers = 'From: '.$service_name.' <'.$email_contact.'>'."\r\n";
			$additional_headers .= 'MIME-Version: 1.0'."\r\n";
			$additional_headers .= 'Content-type: text/html; charset=UTF-8'."\r\n";
			
			if (!mail($email, $service_name.': Nowe hasło', $message, $additional_headers)) {
				echo('<div class="negative">Wystąpił błąd wewnętrzny (błąd serwera) związany z wysyłaniem wiadomości e-mail. Wiadomość prawdopodobnie nie została wysłana. Jeśli wiadomość nie dojdzie, spróbuj wygenerować nowe hasło po raz kolejny.</div>');
				$OK = false;
				throw new ExceptionSendingMessage();
			}
		} else {
			$OK = false;
		}
	} else {
		$OK = false;
	}
	
	if ($OK) {
		DailyAdd('Wygenerowano i wysłano nowe hasło na adres '.$email.'.', LEVEL_EVENT);
	} else {
		DailyAdd('Wystąpił błąd przy generowaniu i wysyłaniu nowego hasło na adres '.$email.'.', LEVEL_ERROR);
	}
	
	return $OK;
}

/**
 * Generuje dowolnej długości (określonej przez parametr) ciąg losowych cyfr.
 * @param $digit_count
 * @return int
 */
function GenerateRandomDigitSerie($digit_count)
{
	srand();
	
	return rand(1000000, 100000000000);
	
	/*
	UWAGA: Z JAKIEGOŚ POWODU PONIŻSZY KOD GENERUJE TAKI SAM TOKEN DLA DWÓCH WYWOŁAŃ
	TODO: SPRAWDZIĆ TO, koniecznie! W celach naukowych.
 
	$serie = '';
	for($i=1; $i<=$digit_count; $i++)
	{
	  $serie .= rand(0,9);
	}
 
	return $serie;
	*/
}

/**
 * Generuje nowy token bezpieczeństwa używany do przeciwstawiania się atakom typu CSRF.
 * @return Nowy token bezpieczeństwa.
 */
function GenerateNewToken()
{
	$_SESSION['token'] = intval(GenerateRandomDigitSerie(20));
}

/**
 * Funkcja używana przy opcji "Zapomniałem hasła" - przy potwierdzeniu zmiany hasła na wygenerowane, zawartość kolumny
 * haslo zostaje zastapiona zawartością kolumny haslo_wygenerowane
 * @param $id_account
 * @param $activation_code
 * @return bool
 * @throws ExceptionSQL
 */
function AccountActivateGeneratedPassword($id_account, $activation_code)
{
	global $database_handle, $database_prefix, $database_handle;
	
	$id_account = intval($id_account);
	$activation_code = htmlspecialchars(addslashes($activation_code));
	
	$query = "UPDATE ".$database_prefix."_users
                   SET password = password_generated
                 WHERE
                       id='".$id_account."'
                   AND
                       activation_code='".$activation_code."'";
	
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	return (mysql_affected_rows($database_handle) == 1);
}


/**
 * Uaktualnia profil użytkownika podanymi jako parametr danymi. Zgłasza odpowiednie wyjątki kiedy dane są błędne.
 * @param $token
 * @param $email
 * @param $password
 * @param $name
 * @param $surname
 * @param $sex
 * @throws ExceptionAccessDenied
 * @throws ExceptionEmailSend
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidPassword
 * @throws ExceptionInvalidToken
 * @throws ExceptionRecordAlreadyExists
 * @throws ExceptionSQL
 * @throws ExceptionUserDoesntExists
 */
function UpdateUserProfile($token, $email, $password, $name, $surname, $sex)
{
	global $database_handle, $database_prefix, $seed_private;
	
	$token = intval($token);
	$email = addslashes(htmlspecialchars($email));
	$password = addslashes(htmlspecialchars($password));
	$name = addslashes(htmlspecialchars($name));
	$surname = addslashes(htmlspecialchars($surname));
	$sex = intval($sex);
	
	$password = sha1($seed_private.$password);
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$query = 'SELECT password FROM '.$database_prefix.'_users WHERE id='.$_SESSION['id'];
	$result = RunQuery($query);
	$row = mysql_fetch_assoc($result);
	
	if ($password != $row['password']) {
		throw new ExceptionInvalidPassword();
	}
	
	$query = 'UPDATE '.$database_prefix.'_users
               SET name = "'.$name.'",
                   surname = "'.$surname.'",
                   sex = "'.$sex.'"
             WHERE id = '.$_SESSION['id'];
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	$_SESSION['profile'] = GetAccountDetails($_SESSION['id']);
	DailyAdd('Zmiana ustawień konta o ID='.$_SESSION['id'].'.', LEVEL_EVENT);
	
	// Updating e-mail address
	if ($email != $_SESSION['profile']['email']) {
		// Changing e-mail if there is no such e-mail in database yet (excluding user self email), otherwise throw error
		$query = 'SELECT email
                FROM '.$database_prefix.'_users
               WHERE email = "'.$email.'" AND NOT id = '.$_SESSION['id'];
		RunQuery($query, false, $statement);
		if (NumQueryRows($statement) > 0) {
			throw new ExceptionRecordAlreadyExists('Ten adres e-mail "'.$email.'" jest już zarejestrowany w naszej bazie.');
		}
		
		$query = 'UPDATE '.$database_prefix.'_users
                 SET new_email = "'.$email.'"
               WHERE id = '.$_SESSION['id'];
		$result = RunQuery($query);
		if (!$result) {
			throw new ExceptionSQL();
		}
		DailyAdd('Zmiana e-mail konta o ID='.$_SESSION['id'].'.', LEVEL_EVENT);
		DeActivateAccount();
		SendActivateMailToUserWithId($_SESSION['id']);
		Logout();
	}
}

/**
 * Zapisje odpowiednie ustawienie w profilu użytkownika (dość niebezpieczne).
 * @param $setting_key_name
 * @param $value
 * @throws ExceptionSQL
 */
function ChangeUserProfileSetting($setting_key_name, $value)
{
	global $database_handle, $database_prefix;
	
	$setting_key_name = addslashes(htmlspecialchars($setting_key_name));
	$value = addslashes(htmlspecialchars($value));
	
	$query = 'UPDATE '.$database_prefix.'_users
               SET '.$setting_key_name.' = "'.$value.'"
             WHERE id = '.$_SESSION['id'];
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$_SESSION[$setting_key_name] = $value;
}

/**
 * Wyciąga rozszerzenie z nazwy pliku podanej jako parametr.
 * @param $nazwa_pliku
 * @return string
 */
function WyciagnijRozszerzeniePliku($nazwa_pliku)
{
	return strtolower(mb_substr(strrchr($nazwa_pliku, '.'), 1));
}


/**
 * Wysyła list aktywacyjny do użytkownika o podanym identyfikatorze.
 * @param $id_uzytkownika
 * @throws ExceptionEmailSend
 * @throws ExceptionInvalidData
 * @throws ExceptionSQL
 */
function SendActivateMailToUserWithId($id_uzytkownika)
{
	global $database_handle, $database_prefix, $service_name, $service_base_address, $time_after_which_inactive_accounts_will_be_deleted, $path, $kontakt_email;
	
	$id_uzytkownika = intval($id_uzytkownika);
	
	$query = "SELECT id, login, email, new_email, sex, activation_code
                  FROM ".$database_prefix."_users
                 WHERE id = '".$id_uzytkownika."'
                   AND active = 0";
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) != 1) {
		throw new ExceptionInvalidData('<div class="uwaga">Podany użytkownik nie istnieje albo jest już aktywny. Wiadomość z linkiem aktywującym nie została wysłana.');
	}
	
	$row = FetchQuery($statement);
	if ($row['new_email'] != '') {
		$email_uzytkownika = $row['new_email'];
	} else {
		$email_uzytkownika = $row['email'];
	}
	$login_uzytkownika = $row['login'];
	
	$activation_code = $row['activation_code'];
	$link_aktywujacy = $service_base_address.$path['activate_account'].'?id='.$row['id'].'&amp;kod='.$activation_code;
	
	$message =
		'<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">
    <HTML>
    <HEAD>
    <META http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <STYLE>
          body { width:100%; background-color: #DFE3EA; text:#000000; color:#000000; font-family: Tahoma, sans-serif; font-size: 10pt; }
      a:link { color: #FF9966 }
      a:visited { color: #FF9900 }
      a:hover { color: #6699CC }
      .tresc { width: 50%; margin: 15pt; }
    </STYLE>
    </HEAD>
    <BODY>

  <div class="tresc">
    <h1>Dzień dobry,</h1>
    <p>dostał'.($row['sex'] == SEX_FEMALE ? 'a' : 'e').'ś ten list ponieważ Ty (lub ktoś podający się za Ciebie)
    założył konto w serwisie '.$service_name.' ( <a href="'.$service_base_address.'">'.$service_base_address.'</a> ). Aby można było korzystać z konta należy je aktywować kliknięciem na poniższy link. Jeśli nie zakładał'.($row['sex'] == SEX_FEMALE ? 'a' : 'e').'ś konta na podanej witrynie, zignoruj ten list. Nieaktywne konta są usuwane w przeciągu '.$time_after_which_inactive_accounts_will_be_deleted.' dni.</p>

    <h3>Dane konta:</h3>
    <pre>
    Login: '.$login_uzytkownika.' <br />
    Adres e-mail: '.$email_uzytkownika.' <br />
    </pre>

    <h3>Link aktywacyjny</h3>
    <p>
    <a href="'.$link_aktywujacy.'">'.$link_aktywujacy.'</a>
    </p>

    <p>Dziękujemy!<br />Zespół '.$service_name.'</p>
    </div>

    </BODY>
    </HTML>';
	$additional_headers = 'From: '.$service_name.' <'.$kontakt_email.'>'."\r\n";
	$additional_headers .= 'MIME-Version: 1.0'."\r\n";
	$additional_headers .= 'Content-type: text/html; charset=UTF-8'."\r\n";
	
	if (!mail($email_uzytkownika,
		preg_replace(array('/http:\/\/www\./', '/\//'), '', $service_base_address).': Aktywacja konta', $message,
		$additional_headers)) {
		throw new ExceptionEmailSend('Wystąpił błąd wewnętrzny (błąd serwera) związany z wysyłaniem wiadomości e-mail. Wiadomość prawdopodobnie nie została wysłana. Przejdź do panelu logowania, spróbuj się zalogować i postępuj zgodnie ze wskazówkami.');
	}
	
	DailyAdd('Wysłano list aktywujący do użytkownika o ID='.$id_uzytkownika.'.', LEVEL_INF);
}

/**
 * Zwraca login przypisany do konta o podanym jako parametr identyfikatorze.
 * @param $id_account
 * @return bool
 * @see ZwrocIdKonta()
 */
function ZwrocLoginKonta($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	$id_account = intval($id_account);
	
	// If an identifier reffers to actually logged user, then don't waste a time for the query and return session data
	if ($id_account == $_SESSION['id']) {
		return $_SESSION['login'];
	}
	
	$query = 'SELECT login FROM '.$database_prefix.'_users WHERE (id='.$id_account.')';
	$result = RunQuery($query);
	
	$row = mysql_fetch_assoc($result);
	
	mysql_free_result($result);
	
	return $row['login'];
}

// If a given account exists, the function returns its identifier, if doesn't exists, the function throws an ExceptionNoResults, if an error occured, it throws appropriate exception
/**
 * Zwraca identyfikator konta o podanym jako parametr loginie.
 * @param $login
 * @return mixed
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @throws ExceptionTooMuchResults
 * @see ZwrocLoginKonta()
 */
function ZwrocIdKonta($login)
{
	global $database_handle, $database_prefix;
	
	$login = addslashes($login);
	
	// If an identifier reffers to actually logged user, then don't waste a time for the query and return session data
	if ($login == $_SESSION['login']) {
		return $_SESSION['id'];
	}
	
	$query = 'SELECT id FROM '.$database_prefix.'_users WHERE login = "'.$login.'"';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	// If there is exactly one result
	if (NumQueryRows($statement) == 1) {
		$row = FetchQuery($statement);
		return $row['id'];
	} else {
		throw new ExceptionTooMuchResults();
	}
}

// If a given account exists, the function returns its identifier, if doesn't exists, the function throws an ExceptionNoResults, if an error occured, it throws appropriate exception
/**
 * Zwraca identyfikator do konta o podanym jako parametr e-mailu.
 * @param $email
 * @return mixed
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @throws ExceptionTooMuchResults
 */
function ZwrocIdKontaOEmail($email)
{
	global $database_handle, $database_prefix;
	
	$email = addslashes($email);
	
	$query = 'SELECT id FROM '.$database_prefix.'_users WHERE email="'.$email.'"';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	// If there is exactly one result
	if (NumQueryRows($statement) == 1) {
		$row = FetchQuery($statement);
		return $row['id'];
	} else {
		throw new ExceptionTooMuchResults();
	}
}

/**
 * Zwraca e-mail przypisany do konta o podanym jako parametr identyfikatorze.
 * @param $id_account
 * @return bool
 * @throws ExceptionSQL
 */
function ZwrocEmailKonta($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	$id_account = intval($id_account);
	
	$query = 'SELECT email FROM '.$database_prefix.'_users WHERE (id='.$id_account.')';
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$row = mysql_fetch_assoc($result);
	
	return $row['email'];
}

/**
 * Zwraca imię przypisane do konta o podanym jako parametr identyfikatorze.
 * @param $id_account
 * @return bool
 * @throws ExceptionSQL
 */
function GetAccountName($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	$id_account = intval($id_account);
	
	// If an identifier reffers to actually logged user, then don't waste a time for the query and return session data
	if ($id_account == $_SESSION['id']) {
		return $_SESSION['profile']['name'];
	}
	
	$query = 'SELECT name FROM '.$database_prefix.'_users WHERE (id='.$id_account.')';
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$row = mysql_fetch_assoc($result);
	
	return $row['name'];
}

/**
 * Zwraca nazwisko przypisane do konta o podanym jako parametr identyfikatorze.
 * @param $id_account
 * @return bool
 * @throws ExceptionSQL
 */
function GetAccountSurname($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	$id_account = intval($id_account);
	
	// If an identifier refers to actually logged user, then don't waste a time for the query and return session data
	if ($id_account == $_SESSION['id']) {
		return $_SESSION['profile']['surname'];
	}
	
	$query = 'SELECT surname FROM '.$database_prefix.'_users WHERE id = '.$id_account;
	
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$row = mysql_fetch_assoc($result);
	
	return $row['surname'];
}

/**
 * Sprawdza czy użytkownik o podanym identyfikatorze istnieje w serwisie.
 * @param $id_account Identyfikator użytkownika.
 * @return bool Zwraca True jeśli istnieje (może być nieaktywny) lub False jeśli nie istnieje.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function IsAccountExists($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_account = intval($id_account);
	
	if ($id_account == $_SESSION['id']) {
		return true;
	}
	
	$query = 'SELECT id FROM '.$database_prefix.'_users WHERE id = '.$id_account;
	RunQuery($query, false, $statement);
	
	return NumQueryRows($statement) > 0;
}

/**
 * Określa typ konta użytkownika o identyfikatorze podanym jako parametr.
 * @param $id_account
 * @return string Typ konta użytkownika.
 * @throws ExceptionSQL
 */
function ZwrocTypKonta($id_account)
{
	global $database_handle, $database_prefix;
	
	$id_account = intval($id_account);
	
	// If an identifier refers to actually logged user, then don't waste a time for the query and return session data
	if ($id_account == $_SESSION['id']) {
		return $_SESSION['account_type'];
	}
	
	$query = 'SELECT account_type FROM '.$database_prefix.'_users WHERE id = '.$id_account;
	
	$result = RunQuery($query);
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$row = mysql_fetch_assoc($result);
	
	return $row['account_type'];
}


/**
 * Zmienia opis konta o podanym identyfikatorze.
 * @param $id_account
 * @param $opis
 * @return bool
 * @throws ExceptionAccessDenied
 */
function ZmienOpisKonta($id_account, $opis)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		if ($id_account != $_SESSION['id']) {
			throw new ExceptionAccessDenied();
		}
	}
	
	$opis = addslashes(htmlspecialchars($opis));
	$id_account = intval($id_account);
	
	$query = 'UPDATE '.$database_prefix.'_users SET opis="'.$opis.'" WHERE id='.$id_account;
	
	$result = RunQuery($query);
	
	if ($result) {
		$_SESSION['profile']['opis'] = $opis;
		DodajPowiadomienie($_SESSION['id'], POWIADOMIENIE_ZMIANA_OPISU, $id_account);
		return true;
	} else {
		return false;
	}
}


/**
 * Wyciąga opis konta o podanym identyfikatorze.
 * @param $id_account Identyfikator konta.
 * @return string
 */
function ZwrocOpisKonta($id_account)
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		return false;
	}
	
	$id_account = intval($id_account);
	
	// Jeśli identyfikator użytkownika odnosi się do aktualnie zalogowanego użytkownika to nie marnuj czasu na zapytanie i zwróć dane z przechowywane w sesji
	if ($id_account == $_SESSION['id']) {
		return $_SESSION['profile']['opis'];
	} else {
		$query = 'SELECT opis FROM '.$database_prefix.'_users WHERE id='.$id_account;
		
		$result = RunQuery($query);
		
		if ($result) {
			$row = mysql_fetch_assoc($result);
			mysql_free_result($result);
			return $row['opis'];
		} else {
			return '';
		}
	}
}

/**
 * Określa tekstowy odpowiednik typu konta (liczbowego) podanego jako parametr.
 * @param $account_type
 * @return string
 */
function PrzetlumaczTypKonta($account_type)
{
	$account_type = intval($account_type);
	switch ($account_type) {
		case ADMINISTRATOR :
			return "administrator";
			break;
		case USER :
			return "użytkownik";
			break;
		default :
			return "gość";
			break;
	}
}


/**
 * Dodaje wpis o podanej jako parametr treści do tekstowego dziennika. Zajmuje się tzw. loggingiem (czyli logowaniem
 * zdarzeń) o różnym priorytecie.
 * @param Zawartość wpisu.
 * @param Priorytet wpisu - może przyjąć następujące wartości (zdefiniowane w pliku variables_global.php) LEVEL_INF,
 *                        LEVEL_EVENT, LEVEL_ERROR.
 * @global
 */
function DailyAdd($daily_content, $priorytet = PRIORITY_LOW)
{
	global $path;
	
	$daily_content = addslashes(htmlspecialchars($daily_content));
	$priorytet = intval($priorytet);
	
	$date = date("j-m-y");
	$time = date("H:i:s");
	
	if (!file_exists($path['log_daily'])) {
		$database_handle = @fopen($path['log_daily'], "w");
	}
	
	if (filesize($path['log_daily']) > 3 * 1024 * 1024) { // overwritting
		$database_handle = @fopen($path['log_daily'], "w");
	} else {
		$database_handle = @fopen($path['log_daily'], "a");
	}
	
	if ($database_handle != false) {
		@flock($database_handle, LOCK_EX);
		@fwrite($database_handle,
			$priorytet.': '.'['.addslashes(htmlspecialchars($_SERVER['REMOTE_ADDR'])).', '.$date.' '.$time.'] '.$daily_content."\r\n");
		@flock($database_handle, LOCK_UN);
		@fclose($database_handle);
	}
}

/**
 * Wyświetla dziennik zdarzeń.
 * @throws ExceptionNoResults
 */
function DailyDisplay()
{
	global $path;
	
	if (!file_exists($path['log_daily'])) {
		throw new ExceptionNoResults('Plik dziennika nie istnieje.');
	}
	
	$diary_content = file_get_contents($path['log_daily']);
	echo('
  <textarea cols="120" rows="25">
  '.htmlspecialchars(htmlspecialchars_decode($diary_content)).'
  </textarea>
  ');
}


/**
 * Wypisuje ostatnio zarejestrowanych użytkowników.
 * @param $ilosc Maksymalna ilość użytkowników do wypisania.
 * @return bool
 */
function WypiszOstatnioZarejestrowanychUzytkownikow($ilosc)
{
	global $database_handle, $database_prefix, $path;
	
	$ilosc = intval($ilosc);
	$OK = true;
	
	$query = 'SELECT id,
                       login
                   FROM '.$database_prefix.'_users
                  WHERE account_type='.USER.'
               ORDER BY date_register DESC
                  LIMIT '.$ilosc;
	RunQuery($query, false, $statement);
	
	$i = 0;
	if (($ilosc_zwroconych = NumQueryRows($statement)) != 0) {
		while ($row = FetchQuery($statement)) {
			echo('<a href="'.$path['profile'].'?id_uzytkownika='.$row['id'].'">'.stripslashes($row['login']).'</a>');
			$i++;
			if ($i < $ilosc_zwroconych) {
				echo(', ');
			}
		}
		echo('...');
	} else {
		echo('<div class="uwaga">Nie ma jeszcze żadnych zarejestrowanych użytkowników.</div>');
	}
	
	return $OK;
}


/**
 * Uwaga!
 * Z uwagi na to, że użytkownik pozostawia w bazie różnorodne informacje
 * powiązane z jego kontem, nie można usunąć wpisu jego konta ot tak.
 * Dlatego robi sie taki myk: wszystkie informacje jakie wstawił do bazy
 * użytkownik (ogłoszenia, zdjęcia, posty) przechodzą na własność konta
 * którego nazwa jest określona w stałej ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT
 * Dopiero po tej operacji można usunąć pierwotne konto (gdy w bazie nie będzie
 * już żadnej informacji powiązanej z danym kontem). Gdyby ktoś miał lepszy pomysł,
 * na usuwanie konta, to proszony jest o kontakt ;-)
 * Drugi parametr ustawiony na TRUE powoduje, że funkcja działa również w przypadku
 * gdy użytkownik nie ma uprawnień administracyjnych i nie jest właścicielem konta
 * ten tryb służy wyłącznie celom systemowym (tzn... usuwanie nieaktywnych kont po tygodniu)
 * @param      $id_account Identyfikator konta do usunięcia.
 * @param bool $mechanizm_wewnetrzny
 * @return bool Informacja o tym czy konto zostało usunięte (True/False)
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @throws ExceptionTooMuchResults
 */
function UsunKonto($id_account, $mechanizm_wewnetrzny = false)
{
	global $database_handle, $database_prefix;
	
	$id_account = intval($id_account);
	// Nie można usunąć konta zastępczego
	$OK = true;
	
	// Tylko nad-użytkownicy i właściciele konta mogą usuwać swoje konto (nadużytkownicy mogą usuwać wszystkie konta)
	if ((!$mechanizm_wewnetrzny) && ($_SESSION['account_type'] < ADMINISTRATOR) && ($_SESSION['id'] != $id_account)) {
		return false;
	}
	
	$id_zastepcze = ZwrocIdKonta(ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT);
	// Jeśli wystąpiło żądanie usunięcia konta zastępczego lub konta ROOT'a
	if ($id_account == $id_zastepcze) {
		return false;
	}
	
	// Jeśli zastępcze konto nie istnieje
	if ($id_zastepcze == 0) {
		echo('<div class="negative">Konto zastępcze o nazwie '.ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT.' nie może zostać odnalezione. Jeśli nie istnieje, należy je utworzyć!</div>');
		return false;
	}
	
	$query = "SET AUTOCOMMIT = 0";
	$result = RunQuery($query);
	if (!$result) {
		$OK = false;
	}
	
	$query = "START TRANSACTION";
	$result = RunQuery($query);
	if (!$result) {
		$OK = false;
	}
	
	if ($OK) {
	
	} else {
		$OK = false;
		echo('<div class="negative">Wystąpił błąd podczas usuwania konta o ID = '.$id_account.'.<br />Spójność bazy danych mogła zostać naruszona.</div>');
	}
	
	if (!$OK) {
		$query = "ROLLBACK;";
		RunQuery($query);
		DailyAdd('Wystąpił błąd przy usuwaniu konta o ID='.$id_account.' z konta użytkownika o ID='.$_SESSION['id'].'. Struktura i zawartość bazy danych została przywrócona z momentu przed rozpoczęciem operacji.',
			LEVEL_ERROR);
	}
	
	return $OK;
}


/**
 * Sprawdza czy konto o podanym loginie jest aktywne.
 * @param $login
 * @return bool
 * @throws ExceptionSQL
 */
function isAccountActive($login)
{
	global $database_handle, $database_prefix;
	
	$login = addslashes($login);
	
	$query = 'SELECT active FROM '.$database_prefix.'_users WHERE login = "'.$login.'"';
	RunQuery($query, false, $statement);
	
	// if there is exactly one result
	if (NumQueryRows($statement) == 1) {
		$row = FetchQuery($statement);
		// $row['active'] contains now 1 if user with that $login is active or 0 if it's not
		return (intval($row['active']) == 1);
	} else {
		return false;
	}
}

/**
 * Ustawia przekierowanie występujące zaraz po zalogowaniu. Zmienne przechowuje w sesji.
 * @param $url
 */
function SetAfterLoginRedirect($url)
{
	$url = addslashes($url);
	$_SESSION['afterLoginRedirect'] = $url;
}

/**
 * Zwraca URL adresu pod który użytkownik ma zostać przekierowany po zalogowaniu. Zmienne przechowuje w sesji.
 * @return string
 */
function GetAfterLoginRedirect()
{
	if ($_SESSION['afterLoginRedirect'] == '') {
		return '/';
	} else {
		return $_SESSION['afterLoginRedirect'];
	}
}


/**
 * Tworzy przekierowanie pod adres podany jako parametr za pomocą skryptu JavaScript.
 * @param     $redirect_URL     Adres docelowy przekierowania.
 * @param int $delay_in_seconds Czas jaki ma upłynąć od momentu załadowania strony do momentu przekierowania.
 */
function RedirectJavaScript($redirect_URL, $delay_in_seconds = 1)
{
	global $path, $service_base_address;
	
	$redirect_URL = htmlspecialchars($redirect_URL);
	$delay_in_seconds = intval($delay_in_seconds);
	$redirect_URL = preg_replace('|&amp;|', '&', $redirect_URL);
	
	// If return URL is following to login page, then change it to the main page
	if (strpos($redirect_URL, $path['login']) >= 0) {
		$return_url = $service_base_address;
	}
	
	echo('
  <script type="text/javascript">
    //<![CDATA[
    setTimeout(\'location.href="'.$redirect_URL.'"\','.($delay_in_seconds * 1000).')
    //]]>
  </script>
  ');
}

/**
 * Sprawdza czy adres IP został zablokowany w serwisie.
 * @param $IP
 * @return bool
 * @throws ExceptionSQL
 */
function IsIPAddressBlocked($IP)
{
	global $database_handle, $database_prefix;
	
	$IP = addslashes(htmlspecialchars($IP));
	
	if (SprawdzCzyPoprawnyAdresIP($IP)) {
		// ważne żeby się tutaj połączyć z bazą ponieważ wywołanie powyższej funkcji rozłącza z bazą
		$query = 'SELECT id
                FROM '.$database_prefix.'_users
               WHERE IP = "'.$IP.'"
                 AND blocked = 1
               LIMIT 1';
		RunQuery($query, false, $statement);
		
		// Jeśli w bazie istnieje podany adres (jako blocked)
		return NumQueryRows($statement) > 0;
	}
	// Nawet jeśli podany adres jest błędny zwróć false
	return false;
}

/**
 * Wyciąga adres IP użytkownika o podanym identyfikatorze.
 * // Tylko z uprawnieniami administratora
 * @param $id_uzytkownika
 * @return bool
 */
function ZwrocAdresIPZnajacIDUzytkownika($id_uzytkownika)
{
	global $database_handle, $database_prefix, $administrator;
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		return false;
	}
	
	$id_uzytkownika = intval($id_uzytkownika);
	
	$query = 'SELECT IP FROM '.$database_prefix.'_users WHERE id='.$id_uzytkownika.' LIMIT 1';
	$result = RunQuery($query)
	or die("Zapytanie mySQL zakończone niepowodzeniem przy próbie uzyskania adresu IP internauty, który zamieścił ogłoszenie o podanym ID.<br /><br />Serwer zwrócił następujący błąd:<br /><i>".mysql_error()."</i>");
	
	// Jest tylko jeden wynik
	$wynik = mysql_fetch_assoc($result);
	
	return $wynik[0];
}


/**
 * Wyświetla listę zablokowanych użytkowników.
 * // Tylko z uprawnieniami administratora
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function DisplayBlockedUsers()
{
	global $database_handle, $database_prefix, $directory;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$query = 'SELECT DISTINCT login, email, name, surname, IP
                       FROM '.$database_prefix.'_users
                      WHERE blocked=1';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		echo('<div class="uwaga">Brak zablokowanych adresów IP.</div>'."\r\n");
	} else {
		echo('<table>
      <thead><tr><th>Imię</th><th>Nazwisko</th><th>Login</th><th>E-mail</th><th>Adres IP</th><th>Opcja odblokowania</th></tr></thead>
      <tbody>
    ');
		while ($row = FetchQuery($statement)) {
			echo('    <tr><td>'.$row['imie'].'</td><td>'.$row['nazwisko'].'</td><td>'.$row['login'].'</td><td>'.$row['email'].'</td><td>'.$row['IP'].'</td><td><a href="'.$directory['base'].'index.php?odblokuj='.$row['IP'].'">Odblokuj ten adres</a></td></tr>'."\r\n");
		}
		echo('  </tbody>
    </table>
    ');
	}
	
	DailyAdd('Wykonano listing blokowanych adresów z konta o ID='.$_SESSION['id'].'.', LEVEL_INF);
}

/**
 * Blokuje lub odblokowuje użytkownika o podanym jako parametr adresie IP, loginie lub emailu. Do działania wymaga
 * podania tokena.
 * // Tylko z uprawnieniami administratora
 * @param     $IP_or_login_or_email Adres IP, login lub email użytkownika, którego należy zablokować.
 * @param     $token                Token bezpieczeństwa zapewniający ochronę przez atakami typu CSRF.
 * @param int $action               Może przybrać jedną z dwóch stałych: BLOCK lub UNBLOCK
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function BlockUnblockUser($IP_or_login_or_email, $token, $action = BLOCK)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$IP_or_login_or_email = addslashes(htmlspecialchars($IP_or_login_or_email));
	$token = addslashes(htmlspecialchars($token));
	$action = intval($action);
	
	$query = 'UPDATE '.$database_prefix.'_users
               SET blocked = '.$action.'
             WHERE
                  (
                   IP = "'.$IP_or_login_or_email.'"
                OR
                   login = "'.$IP_or_login_or_email.'"
                OR
                   email = "'.$IP_or_login_or_email.'"
                   )';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	DailyAdd('Zablokowano użytkownika '.$IP_or_login_or_email.'.', LEVEL_EVENT);
}

/**
 * Wyciąga szczegółowe informacje o użytkowniku o podanym identyfikatorze.
 * @param $id_account
 * @return array|bool
 * @throws ExceptionAccessDenied
 * @throws ExceptionUserDoesntExists
 */
function GetAccountDetails($id_account)
{
	global $database_handle, $database_prefix, $database_handle;
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_account = intval($id_account);
	
	$query = '
          SELECT id,
                account_type,
                login,
                email,
                name,
                surname,
                status,
                sex,
                IP,
                active,
                blocked,
                date_register,
                date_last_login,
                date_last_visit,
                (SELECT TIMEDIFF(NOW(), date_last_visit) FROM '.$database_prefix.'_users AS tabela WHERE tabela.id='.$database_prefix.'_users.id) AS amount_time_from_last_visit
           FROM '.$database_prefix.'_users
          WHERE id = '.$id_account;
	
	try {
		$statement = $database_handle->prepare($query);
		$statement->execute();
		$row = $statement->fetch();
		
		if (isset($row['id'])) {
			throw new ExceptionUserDoesntExists();
		}
		
		DailyAdd('Wykonano wgląd w szczegóły konta o ID='.$id_account.' z konta użytkownika o ID='.$_SESSION['id'].'.',
			LEVEL_EVENT);
		return $row;
		
	} catch (PDOException $exception) {
		DailyAdd('Wystąpił błąd przy wykonywaniu wglądu w szczegóły konta o ID='.$id_account.' z konta użytkownika o ID='.$_SESSION['id'].'.',
			LEVEL_ERROR);
		return false;
		
	}
	
}


/**
 * Rejestruje zgłoszenie nadużycia przez użytkownika.
 * @param $address
 * @param $description
 * @param $token
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function ReportAbuse($address, $description, $token)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$address = addslashes(htmlspecialchars(htmlspecialchars_decode($address)));
	$description = addslashes(htmlspecialchars($description));
	$token = addslashes(htmlspecialchars($token));
	
	
	$query = 'INSERT INTO '.$database_prefix.'_abuse_notifications
                        SET id_user='.$_SESSION['id'].',
                            description="'.$description.'",
                            address="'.$address.'",
                            date_add=CURRENT_TIMESTAMP()';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
}

/**
 * Wyświetla zgłoszenia nadużyć w tabeli.
 * @param int $ilosc
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function DisplayReportedAbuses($ilosc = 0)
{
	global $database_handle, $database_prefix, $directory, $service_base_address, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$ilosc = intval($ilosc);
	if ($ilosc > 0) {
		$SQL_ilosc = 'LIMIT '.$ilosc;
	} else {
		$SQL_ilosc = '';
	}
	
	$query = 'SELECT id,
                   id_user,
                   description,
                   address,
                   date_add
              FROM '.$database_prefix.'_abuse_notifications
          ORDER BY id DESC
             '.$SQL_ilosc;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	
	echo('<table>
    <caption>Zgłoszenia nadużyć</caption>
    <thead><tr><th>Usuń</th><th>Adres</th><th>#ID</th><th>Opis</th><th>Data zgłoszenia</th></tr></thead>
    <tbody>
  ');
	while ($row = FetchQuery($statement)) {
		$info_uwaga = '';
		if ((strpos($row['address'], $service_base_address) < 0) || (strpos($row['address'], 'javascript:') > 0)) {
			$info_uwaga = '<strong>Uwaga! Adres tego zgłoszenia wygląda podejrzanie. Proszę uważać, ponieważ może być to próba przekierowania Ciebie na fałszywą stronę.</strong><br />';
		}
		echo('
    <tr>
      <td><a href="'.$path['admin_reported_abuses'].'?delete_abuse_report='.$row['id'].'&amp;token='.$_SESSION['token'].'"><img src="'.$directory['design'].'ikona_mala_usun.png" alt="Usuń" title="Usuń to zgłoszenie" /></a></td>
      <td>'.$row['address'].'</td>
      <td>'.$row['id'].'</td>
      <td><a target="_blank" href="'.stripslashes($row['address']).'">'.$info_uwaga.$row['description'].'</a></td>
      <td>'.$row['date_add'].'</td>
    </tr>
    ');
	}
	echo('
    </tbody>
  </table>
  ');
}

/**
 * Usuwa zgłoszenie nadużycia o podanym identyfikatorze.
 * @param $id_zgloszenia
 * @param $token
 * @return int
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 */
function DeleteAbuseReport($id_zgloszenia, $token)
{
	global $database_handle, $database_prefix, $database_handle, $directory;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_zgloszenia = intval($id_zgloszenia);
	$token = addslashes(htmlspecialchars($token));
	
	$query = 'DELETE FROM '.$database_prefix.'_abuse_notifications
                      WHERE id='.$id_zgloszenia;
	$result = RunQuery($query);
	if ($result) {
		if (mysql_affected_rows($database_handle) == 1) {
			return OK_WSZYSTKO;
		} else {
			return BLAD_REKORD_NIE_ISTNIEJE;
		}
	} else {
		return BLAD_SQL;
	}
	
}

/**
 * Wstawia skrypt odpowiedzialny za wyświetlanie okienka raportowania nadużyć.
 * @param bool $return_as_string
 * @return mixed
 */
function InsertAbuseReportWindowSupport($return_as_string = false)
{
	global $path;
	
	$HTML = '

  <div id="report_abuse" style="display:none;">
    <div id="ajax_report_abuse_result"></div>
    <form method="post" name="FormReportAbuse" onsubmit="reportAbuse(\'ajax_report_abuse_result\', this.description.value, this.address.value); return false;">
      <fieldset>
        <label for="description">Wpisz treść swojego zgłoszenia (opcjonalne):</label><br />
        <textarea id="description" name="description" cols="70" rows="10"></textarea><br />
        <input type="hidden" name="address" value="'.htmlspecialchars($_SERVER['REQUEST_URI']).'" />
        <input type="hidden" name="token" value="'.$_SERVER['token'].'" />
        <button type="submit" name="ReportAbuseOK">Wyślij zgłoszenie</button>
      </fieldset>
    </form>
  </div>

  <script type="text/javascript">
    function openAbuseReportWindow()
    {
      jQuery("#report_abuse").dialog({
        title:"Zgłaszanie nadużycia",
        width:500,
        height:280,
        closeText: "Zamknij",
        show: {
          effect: "bounce",
          duration: 300
        },
        hide: {
          effect: "drop",
          duration: 500
        }
      });

      jQuery("#report_abuse form").slideDown();
      jQuery("#report_abuse form textarea").val("");
      jQuery("#ajax_report_abuse_result").slideUp();
    }

    function reportAbuse(reply_container_id, param_description, param_address)
    {
      jQuery.getJSON("'.$path['ajaxAbuse'].'",
                     {
                       action: "report",
                       description : param_description,
                       address : param_address,
                       token : "'.$_SESSION['token'].'"
                     },
                     function (data)
                     {
                       jQuery("#"+reply_container_id).hide().html(data.message).slideDown();
                       if (data.state=="reported")
                        jQuery("#report_abuse form").slideUp();
                     }
      );
    }

  </script>
  ';
	
	if ($return_as_string) {
		return str_replace(array("\r\n", "\n"), '', $HTML);
	} else {
		echo($HTML);
	}
}

/**
 * Rejestruje raport dotyczący błędu na stronie.
 * @param $address      Adres URL
 * @param $request_data Dane żądania (POST, GET).
 * @param $browser      Nazwa przeglądarki
 * @param $description  Opis błędu
 * @param $token        Token bezpieczeństwa chroniący przed atakami typu CSRF.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function ReportBug($address, $request_data, $browser, $description, $token)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$address = addslashes(htmlspecialchars(htmlspecialchars_decode($address)));
	$description = addslashes(htmlspecialchars($description));
	$request_data = addslashes(htmlspecialchars($request_data));
	$browser = addslashes(htmlspecialchars($browser));
	$token = addslashes(htmlspecialchars($token));
	
	
	$query = 'INSERT INTO '.$database_prefix.'_bug_notifications
                        SET id_user='.$_SESSION['id'].',
                            description="'.$description.'",
                            address="'.$address.'",
                            request_data = "'.$request_data.'",
                            browser = "'.$browser.'",
                            date_add=CURRENT_TIMESTAMP()';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
}

/**
 * Wyświetla tabelę zgłoszonych na stronie błędów.
 * @param int $ilosc
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function DisplayReportedBugs($ilosc = 0)
{
	global $database_handle, $database_prefix, $directory, $service_base_address, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$ilosc = intval($ilosc);
	if ($ilosc > 0) {
		$SQL_ilosc = 'LIMIT '.$ilosc;
	} else {
		$SQL_ilosc = '';
	}
	
	$query = 'SELECT id,
                   id_user,
                   description,
                   address,
                   browser,
                   request_data,
                   date_add
              FROM '.$database_prefix.'_bug_notifications
          ORDER BY id DESC
             '.$SQL_ilosc;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	echo('<script type="text/javascript">
    function showBugParametersWindow(request_parameters)
    {
      jQuery("<div>").append(request_parameters).dialog({
        title: "Parametry żądania"
      });
    }
  </script>');
	
	
	echo('<table>
    <caption>Zgłoszenia błędów</caption>
    <thead><tr><th>Usuń</th><th>Adres</th><th>Dane żądania (base64)</th><th>Przeglądarka</th><th>#ID</th><th>Opis kroków</th><th>Data zgłoszenia</th></tr></thead>
    <tbody>
  ');
	while ($row = FetchQuery($statement)) {
		$info_uwaga = '';
		if ((strpos($row['address'], $service_base_address) < 0) || (strpos($row['address'], 'javascript:') > 0)) {
			$info_uwaga = '<strong>Uwaga! Adres tego zgłoszenia wygląda podejrzanie. Proszę uważać, ponieważ może być to próba przekierowania Ciebie na fałszywą stronę.</strong><br />';
		}
		echo('
    <tr>
      <td><a href="'.$path['admin_reported_bugs'].'?delete_bug_report='.$row['id'].'&amp;token='.$_SESSION['token'].'"><img src="'.$directory['design'].'ikona_mala_usun.png" alt="Usuń" title="Usuń to zgłoszenie" /></a></td>
      <td>'.$row['address'].'</td>
      <td><a href="#" data-parameters="'.$row['request_data'].'" onclick="showBugParametersWindow(jQuery(this).attr(\'data-parameters\')); return false;">Zobacz parametry w Base64</a></td>
      <td>'.$row['browser'].'</td>
      <td>'.$row['id'].'</td>
      <td><a target="_blank" href="'.stripslashes($row['address']).'">'.$info_uwaga.$row['description'].'</a></td>
      <td>'.$row['date_add'].'</td>
    </tr>
    ');
	}
	echo('
    </tbody>
  </table>
  ');
}

/**
 * Usuwa zgłoszenie błędu o podanym identyfikatorze.
 * @param $id_zgloszenia
 * @param $token
 * @return int
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 */
function DeleteBugReport($id_zgloszenia, $token)
{
	global $database_handle, $database_prefix, $database_handle, $directory;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_zgloszenia = intval($id_zgloszenia);
	$token = addslashes(htmlspecialchars($token));
	
	$query = 'DELETE FROM '.$database_prefix.'_bug_notifications
                      WHERE id='.$id_zgloszenia;
	$result = RunQuery($query);
	if ($result) {
		if (mysql_affected_rows($database_handle) == 1) {
			return OK_WSZYSTKO;
		} else {
			return BLAD_REKORD_NIE_ISTNIEJE;
		}
	} else {
		return BLAD_SQL;
	}
	
}


/**
 * Wstawia skrypt obsługujący okienko służące do zgłaszania błędu.
 * @param bool $return_as_string
 * @return mixed
 */
function InsertBugReportWindowSupport($return_as_string = false)
{
	global $path;
	
	$HTML = '

  <div id="report_bug" style="display:none;">
    <div id="ajax_report_bug_result"></div>
    <form method="post" name="FormReportBug" onsubmit="reportBug(\'ajax_report_bug_result\', this.request_data.value, this.description.value, this.address.value); return false;">
      <fieldset>
        <label for="description">Opisz kroki prowadzące do błędu (opcjonalne):</label><br />
        <textarea id="description" name="description" cols="70" rows="10"></textarea><br />
        <input type="hidden" name="address" value="'.htmlspecialchars($_SERVER['REQUEST_URI']).'" />
        <input type="hidden" name="request_data" value="'.htmlspecialchars(print_r($_REQUEST, true)).'" />
        <input type="hidden" name="token" value="'.$_SERVER['token'].'" />
        <button type="submit" name="ReportBugOK">Wyślij zgłoszenie błędu</button>
      </fieldset>
    </form>
  </div>

  <script type="text/javascript">
    function openBugReportWindow()
    {
      jQuery("#report_bug").dialog({
        title:"Zgłaszanie błędu",
        width:500,
        height:280,
        closeText: "Zamknij",
        show: {
          effect: "bounce",
          duration: 300
        },
        hide: {
          effect: "drop",
          duration: 500
        }
      });

      jQuery("#report_bug form").slideDown();
      jQuery("#report_bug form textarea").val("");
      jQuery("#ajax_report_bug_result").slideUp();
    }

    function reportBug(reply_container_id, param_request_data, param_description, param_address)
    {
      jQuery.getJSON("'.$path['ajaxBug'].'",
                     {
                       action: "report",
                       request_data: param_request_data,
                       browser: navigator.userAgent,
                       description : param_description,
                       address : param_address,
                       token : "'.$_SESSION['token'].'"
                     },
                     function (data)
                     {
                       jQuery("#"+reply_container_id).hide().html(data.message).slideDown();
                       if (data.state=="reported")
                        jQuery("#report_bug form").slideUp();
                     }
      );
    }

  </script>
  ';
	
	if ($return_as_string) {
		return str_replace(array("\r\n", "\n"), '', $HTML);
	} else {
		echo($HTML);
	}
}

/**
 * TODO: tu skończyłem, przetestować
 * Przyjmuje pliki od klienta, zapisuje je do podanego folderu pod unikalną nazwą i zwraca jego nazwę pod którą został
 * umieszczony
 * @param     $nazwa_kontrolki
 * @param int $maksymalny_rozmiar
 * @param     $akceptowane_rozszerzenia
 * @param     $folder_docelowy
 * @param     $nowa_nazwa
 * @throws ExceptionAccessDenied
 * @throws ExceptionFileTooBig
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidExtension
 */
function ReceiveAndSaveFile(
	$nazwa_kontrolki,
	$maksymalny_rozmiar = 0,
	$akceptowane_rozszerzenia,
	$folder_docelowy,
	&$nowa_nazwa
) {
	global $baza_prefix, $przelicznik_transferu_na_zetony;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$plik_tmp = $_FILES[$nazwa_kontrolki]['tmp_name'];
	$plik_nazwa = $_FILES[$nazwa_kontrolki]['name'];
	$plik_rozmiar = abs(intval($_FILES[$nazwa_kontrolki]['size']));
	$nowa_nazwa = '';
	
	// Jeśli nie ma już zdjęć do odebrania to zakończ
	if (trim($plik_tmp) == '') {
		throw new ExceptionInvalidData();
	}
	
	$roz = WyciagnijRozszerzeniePliku($plik_nazwa);
	if (!in_array($roz, $akceptowane_rozszerzenia)) {
		throw new ExceptionInvalidExtension();
	}
	
	if ($maksymalny_rozmiar > 0) // jesli maksymalny rozmiar jest ustawiony na 0 to pomijanie sprawdzania
	{
		if ($plik_rozmiar > $maksymalny_rozmiar) {
			throw new ExceptionFileTooBig();
		}
	}
	
	if (is_uploaded_file($plik_tmp)) {
		$nowa_nazwa = sha1_file($plik_tmp).'.'.$roz;
		move_uploaded_file($plik_tmp, $folder_docelowy.$nowa_nazwa);
		/* Dodanie odpowiednich uprawnień */
		chmod($folder_docelowy.$nowa_nazwa, 0644);
	}
	
	// Dodawanie wpisu do dziennika
	DailyAdd('Przyjęto plik "'.htmlspecialchars($plik_nazwa).'" (i zmieniono nazwę na "'.$nowa_nazwa.'") od użytkownika o ID='.$_SESSION['id'].'.',
		PRIORITY_NORMAL);
}


/**
 * Dodaje nową reklamę do serwisu.
 * @param $token                  Token bezpieczeństwa, chroniący przed atakami typu CSRF.
 * @param $id_advertisement_group Identyfikator grupy bannerów (grupy bannerów są porozmieszczane w różnych miejscach
 *                                szaty graficznej). Stała charakteryzująca grupę bannerów może być odszukana w pliku
 *                                constants_global.php
 * @param $description            Opis reklamy.
 * @param $filename               Nazwa pliku zawierającego reklamę.
 * @param $destination_address    Adres pod który przekierowuje reklama.
 * @param $purchased_views        Ilość wykupionych wyświetleń.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AdvertisementsAddNew(
	$token,
	$id_advertisement_group,
	$description,
	$filename,
	$destination_address,
	$purchased_views
) {
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_advertisement_group = intval($id_advertisement_group);
	$description = addslashes(htmlspecialchars($description));
	$filename = addslashes(htmlspecialchars($filename));
	$destination_address = addslashes(htmlspecialchars($destination_address));
	$purchased_views = intval($purchased_views); // Ilość wykupionych wyswietlen ustawiona na zero oznacza wyświetlanie bannera w nieskończoność
	
	$query = 'INSERT INTO '.$database_prefix.'_advertisements (
                     id_advertisement_group,
                     id_user,
                     description,
                     filename,
                     link,
                     purchased_views,
                     views)
             VALUES(
                     '.$id_advertisement_group.',
                     '.$_SESSION['id'].',
                     "'.$description.'",
                     "'.$filename.'",
                     "'.$destination_address.'",
                     '.$purchased_views.',
                     '.$purchased_views.' /*views*/
                );';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	DailyAdd('Użytkownik o ID='.$_SESSION['id'].' dodał nową jednostkę reklamową reklamodawcy "'.$destination_address.'".',
		PRIORITY_LOW);
}

/**
 * Usuwa jednostkę reklamową o podanym identyfikatorze.
 * @param $token            Token bezpieczeństwa, chroniący przed atakami typu CSRF.
 * @param $id_advertisement Identyfikator jednostki reklamowej.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionNoResults
 * @throws ExceptionTooMuchResults
 */
function AdvertisementsDelete($token, $id_advertisement)
{
	global $database_handle, $database_prefix, $directory;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_advertisement = intval($id_advertisement);
	
	// Jeśli dana reklama istnieje
	$query = 'SELECT filename FROM '.$database_prefix.'_advertisements WHERE id='.$id_advertisement;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults('Próbowano usunąć reklamę, która już nie istnieje.');
	}
	if (NumQueryRows($statement) > 1) {
		throw new ExceptionTooMuchResults('Podanemu identyfikatorowi odpowiada więcej niż jedna reklama.');
	}
	
	$row = FetchQuery($statement);
	$filename = $row['filename'];
	// Badamy ile wpisów odwołuje się do podanego pliku
	$query = 'SELECT id FROM '.$database_prefix.'_advertisements WHERE filename="'.$filename.'"';
	RunQuery($query, false, $statement);
	// Usuwamy wpis reklamy
	$query = 'DELETE FROM '.$database_prefix.'_advertisements WHERE id='.$id_advertisement;
	RunQuery($query, false, $statement);
	
	// Usuwamy plik ale tylko jeśli żadna inna reklama z niego nie korzysta (nie odwołuje się do niego)
	if (NumQueryRows($statement) == 1) {
		unlink($directory['advertisements'].$filename);
		DailyAdd('Użytkownik o ID='.$_SESSION['id'].' usunął reklamę o ID='.$id_advertisement, PRIORITY_NORMAL);
	}
	
}

/**
 * Wyświetla jednostkę reklamową należącą do podanej jako parametr grupy reklam.
 * @param int $advertisement_group
 * @throws ExceptionSQL
 */
function AdvertisementsDisplay($advertisement_group = ADVERTISEMENT_MAIN)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	//if ($_SESSION['account_type']<USER) throw new ExceptionAccessDenied();
	
	$$advertisement_group = intval($advertisement_group);
	
	$query = 'SELECT '.$database_prefix.'_advertisements.id, id_advertisement_group, id_user, description, filename, link, date_add, login
              FROM '.$database_prefix.'_advertisements
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_advertisements.id_user
             WHERE '.$database_prefix.'_advertisements.id_advertisement_group='.$advertisement_group.'
               AND '.$database_prefix.'_advertisements.views>0
          ORDER BY RAND() /* Random order */
             LIMIT 1';
	RunQuery($query, false, $statement);
	if (NumQueryRows($statement) == 0) {
		return;
	}
	
	$row = FetchQuery($statement);
	
	$query2 = 'UPDATE LOW_PRIORITY '.$database_prefix.'_advertisements
                SET views = views-1
              WHERE '.$database_prefix.'_advertisements.id = '.$row['id'];
	$result2 = RunQuery($query2);
	
	if (!$result2) {
		throw new ExceptionSQL('Błąd bazy przy zmniejszaniu pozostałej liczby wyświetleń reklamy.');
	}
	
	echo('
  <div class="banner group_'.$row['id_advertisement_group'].'">
    <a href="'.$row['link'].'"><img src="./'.$directory['advertisements'].$row['filename'].'" alt="Banner" /></a>
  </div>
  ');
}

/**
 * Resetuje licznik wyświetleń jednostki reklamowej o podanym identyfikatorze.
 * @param $token
 * @param $id_advertisement
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AdvertisementsResetCounter($token, $id_advertisement)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_advertisement = intval($id_advertisement);
	if ($id_advertisement <= 0) {
		throw new ExceptionInvalidData();
	}
	
	$query = 'UPDATE '.$database_prefix.'_advertisements
               SET '.$database_prefix.'_advertisements.views = '.$database_prefix.'_advertisements.purchased_views
          WHERE '.$database_prefix.'_advertisements.id = '.$id_advertisement;
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
}

/**
 * Zmienia ilość wykupionych wyświetleń jednostki reklamowej o podanycm identyfikatorze.
 * @param $token            Token bezpieczeństwa, chroniący przed atakami typu CSRF.
 * @param $id_advertisement Identyfikator jednostki reklamowej.
 * @param $purchased_views  Ilość wykupionych wyświeleń.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AdvertisementsChangePurchasedViews($token, $id_advertisement, $purchased_views)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_advertisement = intval($id_advertisement);
	$purchased_views = intval($purchased_views);
	if ($id_advertisement <= 0) {
		throw new ExceptionInvalidData();
	}
	if ($purchased_views <= 0) {
		throw new ExceptionInvalidData();
	}
	
	$query = 'UPDATE '.$database_prefix.'_advertisements
               SET '.$database_prefix.'_advertisements.purchased_views = '.$purchased_views.'
          WHERE '.$database_prefix.'_advertisements.id = '.$id_advertisement;
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	// If purchased views counter is smaller than remaining views counter, then assign to remaining views counter value of purchased views counter
	$query = 'UPDATE '.$database_prefix.'_advertisements
               SET '.$database_prefix.'_advertisements.views = '.$purchased_views.'
             WHERE '.$database_prefix.'_advertisements.id = '.$id_advertisement.'
               AND '.$database_prefix.'_advertisements.views > '.$database_prefix.'_advertisements.purchased_views';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
}

/**
 * Pozwala na zmianę ilości pozostałych wyświetleń jednostki reklamowej o podanym jako parametr identyfikatorze.
 * @param $token            Token bezpieczeństwa, chroniący przed atakami typu CSRF.
 * @param $id_advertisement Identyfikator jednostki reklamowej.
 * @param $remaining_views  Pozostała ilość wyświetleń.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AdvertisementsChangeRemainingViews($token, $id_advertisement, $remaining_views)
{
	global $database_handle, $database_prefix, $database_handle, $directory, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_advertisement = intval($id_advertisement);
	$remaining_views = intval($remaining_views);
	if ($id_advertisement <= 0) {
		throw new ExceptionInvalidData();
	}
	if ($remaining_views <= 0) {
		throw new ExceptionInvalidData();
	}
	
	$query = 'UPDATE '.$database_prefix.'_advertisements
               SET '.$database_prefix.'_advertisements.views = '.$remaining_views.'
             WHERE '.$database_prefix.'_advertisements.id = '.$id_advertisement.'
               AND '.$database_prefix.'_advertisements.purchased_views >= '.$remaining_views;
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	if (mysql_affected_rows($database_handle) == 0) {
		throw new ExceptionInvalidData('Nie zmieniono liczby pozostałych wyświetleń. Być może ustawiłeś liczbę pozostałych wyświetleń większą od ilości wykupionych wyświetleń.');
	}
}


/**
 * Wyświetla listę wszystkich obecnych jednostek reklamowych należących do różnych grup reklam.
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function AdvertisementsDisplayList()
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$query = 'SELECT '.$database_prefix.'_advertisements.id,
                   id_advertisement_group,
                   id_user,
                   description,
                   filename,
                   link,
                   date_add,
                   purchased_views,
                   views,
                   login
              FROM '.$database_prefix.'_advertisements
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_advertisements.id_user
          ORDER BY '.$database_prefix.'_advertisements.date_add';
	RunQuery($query, false, $statement);
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	echo('<table class="advertisement_list">
  <thead>
    <tr><th>ID jednostki</th><th>Grupa</th><th>Opis</th><th>Nazwa pliku</th><th>Wyświetlenia</th><th>Dodał</th><th>Adres przekierowania</th></tr>
  </thead>
  </tbody>
  ');
	while ($row = FetchQuery($statement)) {
		echo('
    <tr class="'.($row['views'] == 0 ? 'warning_row' : '').'">
      <td>
      '.$row['id'].'<br /><br />
        <a href="?delete_id_advertisement='.$row['id'].'&amp;token='.$_SESSION['token'].'" class="button_normal" onclick="return confirm(\'Czy na pewno chcesz usunąć tę reklamę?\');">× Usuń</a><br /><br />
      </td>
      <td>'.AdvertisementsTransalateGroup($row['id_advertisement_group']).'</td>
      <td>'.$row['description'].'</td>
      <td>
        <a href="'.$directory['advertisements'].$row['filename'].'">
          <img src="'.$directory['advertisements'].$row['filename'].'" width="200" />
        </a><br />
        <a href="#" onclick="MessageBox(\'Poniżej wyświetlana jest nazwa pliku wybranej reklamy.\',\''.$row['filename'].'\');">Pokaż nazwę pliku</a>
      </td>
      <td>
        Pozostało<br />'.$row['views'].' z '.$row['purchased_views'].' wykupionych<br />
        '.($row['views'] == 0 ? '<strong>Wykupiona ilość wyświetleń została wyczerpana.</strong>' : '').'<br /><br />

        <a href="#" class="resetAdvertisementViews" data-advertisement_id="'.$row['id'].'" data-token="'.$_SESSION['token'].'">Zresetuj stan licznika</a><br />

        <a href="#" class="changeAdvertisementPurchasedViews" data-advertisement_id="'.$row['id'].'" data-purchased_views="'.$row['purchased_views'].'" data-token="'.$_SESSION['token'].'">Zmień liczbę wykupionych wyświetleń</a><br />

        <a href="#" class="changeAdvertisementRemainingViews" data-advertisement_id="'.$row['id'].'" data-remaining_views="'.$row['views'].'" data-token="'.$_SESSION['token'].'">Zmień liczbę pozostałych wyświetleń</a><br /><br />

      </td>
      <td>'.$row['login'].'<br /><small>'.$row['date_add'].'</small></td>
      <td>'.$row['link'].' <a href="'.$row['link'].'" onclick="return confirm(\'Czy na pewno chcesz przejść pod ten link?\');">&rArr;</a></td>
    </tr>
    ');
	}
	echo('</tbody>
  </table>');
}

/**
 * Tłumaczy grupę jednostek reklamowych na ich umiejscowienie w szacie graficznej serwisu.
 * @param $id_group
 * @return string
 */
function AdvertisementsTransalateGroup($id_group)
{
	switch ($id_group) {
		case ADVERTISEMENT_MAIN:
			return 'główna';
			break;
		
		case ADVERTISEMENT_RIGHT_SIDE:
			return 'prawa, boczna';
			break;
		
		case ADVERTISEMENT_LEFT_SIDE:
			return 'lewa, boczna';
			break;
		
		case ADVERTISEMENT_BOTTOM:
			return 'dolna';
			break;
		
		default:
			return 'nieznana';
			break;
	}
}


/**
 * Wyświetla listę wstawek kodowych przydatnych przy wstawianiu skryptu reklamodawcy do serwisu.
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function CodePasteDisplayList()
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$query = 'SELECT '.$database_prefix.'_codepaste.id,
                   id_codepaste_group,
                   id_user,
                   description,
                   code,
                   date_add,
                   login
              FROM '.$database_prefix.'_codepaste
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_codepaste.id_user
          ORDER BY '.$database_prefix.'_codepaste.date_add';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	
	echo('<table class="codepaste_list">
  <thead>
    <tr><th>ID jednostki</th><th>Grupa</th><th>Opis</th><th>Kod</th><th>Dodał</th></tr>
  </thead>
  </tbody>
  ');
	while ($row = FetchQuery($statement)) {
		echo('
    <tr>
      <td>
      '.$row['id'].'<br /><br />
        <a href="?delete_id_codepaste='.$row['id'].'&amp;token='.$_SESSION['token'].'" class="button_normal" onclick="return confirm(\'Czy na pewno chcesz usunąć ten kod?\');">× Usuń</a><br /><br />
      </td>
      <td>'.CodepasteTransalateGroup($row['id_codepaste_group']).'</td>
      <td>'.$row['description'].'</td>
      <td>
        <a href="#" onclick="MessageBox(\'Poniżej wyświetlany jest kod\',\'<pre>\'+atob(\''.base64_encode(htmlspecialchars($row['code'])).'\')+\'</pre>\');">Pokaż kod</a>
      </td>
      <td>'.$row['login'].'<br /><small>'.$row['date_add'].'</small></td>
    </tr>
    ');
	}
	echo('</tbody>
  </table>');
}

/**
 * Dodaje nową wstawkę skryptową do serwisu.
 * @param $token
 * @param $id_codepaste_group
 * @param $description
 * @param $code
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function CodePasteAddNew($token, $id_codepaste_group, $description, $code)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_codepaste_group = intval($id_codepaste_group);
	$description = addslashes(htmlspecialchars($description));
	$code = addslashes($code);
	
	$query = 'INSERT INTO '.$database_prefix.'_codepaste (
                     id_codepaste_group,
                     id_user,
                     description,
                     code)
             VALUES(
                     '.$id_codepaste_group.',
                     '.$_SESSION['id'].',
                     "'.$description.'",
                     "'.$code.'"
                );';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	DailyAdd('Użytkownik o ID='.$_SESSION['id'].' dodał nowy kod śledzenia lub kod reklamowy.', PRIORITY_LOW);
}

/**
 * Usuwa wstawkę skryptową o podanym identyfikatorze z serwisu.
 * @param $token
 * @param $id_codepaste
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidToken
 * @throws ExceptionNoResults
 * @throws ExceptionTooMuchResults
 */
function CodePasteDelete($token, $id_codepaste)
{
	global $database_handle, $database_prefix, $directory;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	if (!isTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	
	$id_codepaste = intval($id_codepaste);
	
	// Jeśli dany kod już istnieje
	$query = 'SELECT id FROM '.$database_prefix.'_codepaste WHERE id='.$id_codepaste;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults('Próbowano usunąć kod śledzenia lub kod reklamowy, który już nie istnieje.');
	}
	if (NumQueryRows($statement) > 1) {
		throw new ExceptionTooMuchResults('Podanemu identyfikatorowi odpowiada więcej niż jeden kod śledzenia/reklamowy.');
	}
	
	$row = FetchQuery($statement);
	
	// Usuwamy wpis reklamy
	$query = 'DELETE FROM '.$database_prefix.'_codepaste WHERE id='.$id_codepaste;
	$result2 = RunQuery($query);
	
	// Jeśli usuwanie się nie powiodło to zgłaszamy wyjątek
	if (!$result2) {
		new ExceptionSQL();
	}
	
	DailyAdd('Użytkownik o ID='.$_SESSION['id'].' usunął kod śledzenia/reklamowy o ID='.$id_codepaste, PRIORITY_NORMAL);
}

/**
 * Wstawia wstawkę skryptową o podanej grupie (wstawki mogą być różne - jedne w nagłówku strony, inne w stopce - grupa
 * wstawki definiuje w którym miejscu strony ma zostać wklejony kod).
 * @param int $code_paste_group
 * @throws ExceptionSQL
 */
function CodePasteDisplay($code_paste_group = CODE_PASTE_HEAD)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	$code_paste_group = intval($code_paste_group);
	
	$query = 'SELECT '.$database_prefix.'_codepaste.id, id_codepaste_group, id_user, description, date_add, code, login
              FROM '.$database_prefix.'_codepaste
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_codepaste.id_user
             WHERE '.$database_prefix.'_codepaste.id_codepaste_group='.$code_paste_group;
	
	RunQuery($query, false, $statement);
	if (NumQueryRows($statement) == 0) {
		return;
	}
	
	while ($row = FetchQuery($statement)) {
		echo("\r\n".'<!-- '.$row['description'].' -->'."\r\n".stripslashes($row['code'])."\r\n\r\n");
	}
	
}


/**
 * Tłumaczy grupę wstawki skryptowej na jej umiejscowienie w kodzie strony (nagłówek, body czy stopka).
 * @param $id_group
 * @return string
 */
function CodePasteTransalateGroup($id_group)
{
	switch ($id_group) {
		case CODE_PASTE_HEAD:
			return 'sekcja HEAD';
			break;
		
		case CODE_PASTE_BODY:
			return 'sekcja BODY';
			break;
		
		default:
			return 'nieznana';
			break;
	}
}

/**
 *
 */
function ProtectAgainstSessionHijacking()
{
	// Protection from session hijacking
	if (!isset($_SESSION['host'])) {
		return;
	}
	if ($_SESSION['host'] !== GetHostByAddr($_SERVER['REMOTE_ADDR'])) {
		DailyAdd('Usunięto dane sesji użytkownika o ID='.$_SESSION['id'].' w obawie o możliwość przejęcia sesji.',
			LEVEL_EVENT);
		Logout();
	}
}


/**
 * Jeśli użytkownik zapomniał dopisać http:// przed adresem, to ten skrypt to poprawia i jednocześnie zabezpiecza przed
 * wprowadzeniem do bazy niebezpiecznych znaków.
 * @param $adres_url
 * @return string
 */
function CorrectURL($adres_url)
{
	$adres_url = addslashes(htmlspecialchars(strtolower($adres_url)));
	if ($adres_url == '') {
		return '';
	}
	
	if (strpos($adres_url, "http://") !== false) {
		return $adres_url;
	} else {
		return "http://".$adres_url;
	}
}


/**
 * Zamiana popularnej gwiazdki (*) na wieloznacznik SQL (%).
 * @param $ciag
 * @return mixed
 */
function ChangeStarToSQLWildChar($ciag)
{
	for ($i = 0; $i <= strlen($ciag); $i++) {
		if ($ciag[$i] == '*') {
			$ciag[$i] = '%';
		}
	}
	return $ciag;
}


/**
 * Wyświetla formularz kontaktowy.
 * @param string $param_email
 * @param string $param_content
 */
function DisplayFormContact($param_email = '', $param_content = '')
{
	$param_email = htmlspecialchars(htmlspecialchars_decode(trim($param_email)));
	$param_content = htmlspecialchars(htmlspecialchars_decode(trim($param_content)));
	
	echo('
  <form action="#" method="post">
    <label for="contact_email">Twój adres e-mail:</label><br />
    <input type="email" name="contact_email" id="contact_email" size="50" value="'.($_SESSION['initiated'] ? $_SESSION['profile']['email'] : ($param_email != '' ? $param_email : 'wprowadź adres e-mail')).'" style="width:95%;" /><br /><br />

    <label for="contact_email_content">Treść wiadomości:</label><br />
    <textarea name="contact_email_content" id="contact_email_content" cols="44" rows="12">'.$param_content.'</textarea><br />

    <div style="text-align:right; margin-right:10px;"><button type="submit">Wyślij wiadomość</button></div>
  </form>
  ');
}

/**
 * Wyciąga listę znajomych użytkownika o podanym identyfikatorze.
 * @param int $id_user Identyfikator użytkownika.
 * @return array Tablica znajomych posiadajaca następujące pola:<br />
 *                     id - identyfikator znajomego
 *                     login - login znajomego
 *                     sex - płeć znajomego
 *                     won - ilość wygranych rozgrywek przez znajomego
 *                     lost - ilość przegranych rozgrywek przez znajomego
 *                     plays_count - ilość rozgrywek w których uczestniczył znajomy
 *                     scores_sum - liczba punktów zdobytych przez znajomy
 *                     last_seen - data ostatnich odwiedzin znajomego
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function GetFriendList($id_user = -1)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	$query = 'SELECT id, login, sex, won, lost, plays_count, scores_sum, last_seen
              FROM '.$database_prefix.'_friends
         LEFT JOIN '.$database_prefix.'_ranking_without_places
                ON '.$database_prefix.'_friends.id_friend = '.$database_prefix.'_ranking_without_places.id
             WHERE '.$database_prefix.'_friends.id_user='.$id_user.'
          ORDER BY last_seen /* Fresh user will be listed at the top */
              ';
	RunQuery($query, false, $statement);
	if (NumQueryRows($statement) == 0) {
		if ($id_user == $_SESSION['id']) {
			$_SESSION['friends'] = array();
		}
		throw new ExceptionNoResults();
	}
	
	$list = array();
	while ($row = FetchQuery($statement)) {
		$list[] = $row;
	}
	
	// Caching
	if ($id_user == $_SESSION['id']) {
		$_SESSION['friends'] = $list;
	}
	
	return $list;
}

/**
 * Wyświetla listę znajomych korzystając z funkcji GetFriendList
 * @param int $id_user
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @see GetFriendList()
 */
function DisplayFriendList($id_user = -1)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	$friends = GetFriendList($id_user);
	
	echo('<div id="friend_users">');
	foreach ($friends as $row) {
		if ($row['login'] == '') {
			$row['login'] = 'Konto usunięte';
		}
		
		if ($row['sex'] == SEX_FEMALE) {
			$img_sex = '<img src="'.$directory['design'].'icon_female.png" alt="Kobieta" title="Kobieta" />';
		} else {
			$img_sex = '<img src="'.$directory['design'].'icon_male.png" alt="Mężczyzna" title="Mężczyzna" />';
		}
		
		echo($path['profile'].' - '.$row['login'].'">
      <span class="signature">'.$img_sex.' '.$row['login'].'</span>
      <div class="statistics">Wygrane: '.intval($row['won']).' | Przegrane: '.intval($row['lost']).' | Rozgrywki: '.intval($row['plays_count']).' </div>
      <a href="#" class="deleteFromFriends" data-id_user="'.$row['id'].'">Usuń</a>
    </div>
    ');
	}
	echo('</div>');
	echo('
  <script type="text/javascript">

    jQuery(".user_block .deleteFromFriends").click(function (){

      var requestData = {
        "action": "remove",
        "id_user": jQuery(this).attr("data-id_user"),
        "token": "'.$_SESSION['token'].'"
      };

      jQuery.getJSON("'.$path['ajaxFriends'].'",
          requestData,
          function (msg) {
            if (msg.state=="removed")
            {
              jQuery(".deleteFromFriends[data-id_user="+msg.id_user_friend+"]").parent().fadeOut(function () {
                jQuery(this).remove();
                if (jQuery(".deleteFromFriends").length==0)
                {
                  jQuery("#friend_users").html("Brak znajomych.");
                }
              });
            }else if (msg.state=="error")
            {
              alert("Wystąpił błąd: "+msg.message);
            }
          }
      );
      return false;
    });

  </script>
  ');
	
	
}

/**
 * Dodaje użytkownika o podanym identyfikatorze do znajomych aktualnie zalogowanego użytkownika.
 * @param $id_friend
 * @param $token Token bezpieczeństwa chroniący przez atakiem typu CSRF.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AddToFriendList($id_friend, $token)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if (!IsAccountExists($id_friend)) {
		throw new ExceptionInvalidData();
	}
	
	$id_friend = intval($id_friend);
	
	// Data verifiction
	if ($id_friend == $_SESSION['id']) {
		throw new ExceptionInvalidData('Samego siebie do przyjaciół dodać nie możesz! :)');
	}
	
	$query = 'INSERT INTO '.$database_prefix.'_friends
                      SET id_user = '.$_SESSION['id'].',
                          id_friend = '.$id_friend;
	$result = RunQuery($query);
	
	if (!$result) {
		if (mysql_errno() != 1062) {
			throw new ExceptionSQL();
		}
	}
	// Refreshing cache
	try {
		GetFriendList();
	} catch (ExceptionNoResults $e) {
	}
}

/**
 * Usuwa użytkownika o podanym identyfikatorze ze znajomych aktualnie zalogowanego użytkownika.
 * @param $id_friend
 * @param $token Token bezpieczeństwa chroniący przez atakiem typu CSRF.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function DeleteFromFriendList($id_friend, $token)
{
	global $database_handle, $database_prefix, $database_handle;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if (!IsAccountExists($id_friend)) {
		throw new ExceptionInvalidData();
	}
	
	$id_friend = intval($id_friend);
	
	$query = 'DELETE FROM '.$database_prefix.'_friends
                  WHERE id_user = '.$_SESSION['id'].'
                    AND id_friend = '.$id_friend;
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	// Refreshing cache
	try {
		GetFriendList();
	} catch (ExceptionNoResults $e) {
	}
}

/**
 * Sprawdza relację znajomości dwóch użytkowników.
 * @param      $id_friend
 * @param int  $id_user
 * @param bool $refresh_cache
 * @return bool Zwraca True jeśli użytkownicy są znajomymi, False w przeciwnym wypadku.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function IsFriendship($id_friend, $id_user = -1, $refresh_cache = false)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_friend = intval($id_friend);
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	if ($id_friend == $_SESSION['id']) {
		return false;
	}
	
	// If we check relations ship between two other users
	if (($id_user != $_SESSION['id']) || ($refresh_cache)) {
		$query = 'SELECT COUNT(*) AS is_friendship
                FROM '.$database_prefix.'_friends
               WHERE id_user = '.$id_user.'
                 AND id_friend = '.$id_friend;
		$result = RunQuery($query);
		
		if (!$result) {
			throw new ExceptionSQL();
		}
		
		$row = mysql_fetch_assoc($result);
		
		return $row['is_friendship'] > 0;
	} else { // if we check relation between session user and other user
		// we can use cached list
		
		foreach ($_SESSION['friends'] as $element) {
			if ($element['id'] == $id_friend) {
				return true;
			}
		}
		return false;
	}
}

/**
 * Zwraca listę użytkowników będących na czarnej liście użytkownika o identyfikatorze podanym jako parametr.
 * @param int $id_user Identyfikator użytkownika, którego czarną listę chcemy wyciągnąć.
 * @return array Zwraca tablicę z listą użytkowników dodanych na czarną listę przez użytkownika o identyfikatorze
 *                     podanym jako parametr.
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function GetUserBlackList($id_user = -1)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	$query = 'SELECT id, login, sex, won, lost, plays_count, scores_sum, last_seen
              FROM '.$database_prefix.'_blacklist
         LEFT JOIN '.$database_prefix.'_ranking_without_places
                ON '.$database_prefix.'_blacklist.id_blocked_user = '.$database_prefix.'_ranking_without_places.id
             WHERE '.$database_prefix.'_blacklist.id_user='.$_SESSION['id'].'
          ORDER BY last_seen /* Fresh user will be listed at the top */
              ';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) {
		if ($id_user == $_SESSION['id']) {
			$_SESSION['blacklist'] = array();
		}
		throw new ExceptionNoResults('Lista zablokowanych graczy jest pusta.');
	}
	
	$list = array();
	while ($row = FetchQuery($statement)) {
		$list[] = $row;
	}
	
	// Caching
	if ($id_user == $_SESSION['id']) {
		$_SESSION['blacklist'] = $list;
	}
	
	return $list;
}

/**
 * Wyświetla czarną listę użytkownika o identyfikatorze podanym jako parametr. Korzysta z funkcji GetUserBlackList()
 * aby pobrać dane.
 * @param int $id_user
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 * @see GetUserBlackList()
 */
function DisplayUserBlackList($id_user = -1)
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	$blacklist = GetUserBlackList($id_user);
	
	echo('<div id="blocked_users">');
	foreach ($blacklist as $row) {
		if ($row['sex'] == SEX_FEMALE) {
			$img_sex = '<img src="'.$directory['design'].'icon_female.png" alt="Kobieta" title="Kobieta" />';
		} else {
			$img_sex = '<img src="'.$directory['design'].'icon_male.png" alt="Mężczyzna" title="Mężczyzna" />';
		}
		
		if ($row['login'] == '') {
			$row['login'] = 'Konto usunięte';
		}
		
		echo('
    <div class="user_block">
      <span class="signature">'.$img_sex.' <a href="'.$path['profile'].'-'.$row['login'].'">'.$row['login'].'</a></span>
      <div class="statistics">Wygrane: '.intval($row['won']).' | Przegrane: '.intval($row['lost']).' | Rozgrywki: '.intval($row['plays_count']).' </div>
      <a href="#" class="deleteFromBlocked" data-id_user="'.$row['id'].'">Usuń</a>
    </div>
    ');
		
	}
	echo('</div>');
	echo('
  <script type="text/javascript">

    jQuery(".user_block .deleteFromBlocked").click(function (){

      var requestData = {
        "action": "unblock",
        "id_user": jQuery(this).attr("data-id_user"),
        "token": "'.$_SESSION['token'].'"
      };

      jQuery.getJSON("'.$path['ajaxBlacklist'].'",
          requestData,
          function (msg) {
            if (msg.state=="unblocked")
            {
              jQuery(".deleteFromBlocked[data-id_user="+msg.id_user_blacklist+"]").parent().fadeOut(function () {
                jQuery(this).remove();
                if (jQuery(".deleteFromBlocked").length==0)
                {
                  jQuery("#blocked_users").html("Brak zablokowanych użytkowników.");
                }
              });
            }else if (msg.state=="error")
            {
              alert("Wystąpił błąd: "+msg.message);
            }
          }
      );
      return false;
    });

  </script>
  ');
}

/**
 * Dodaje do czarnej listy użytkownika o identyfikatorze podanym jako parametr.
 * @param $id_blocked_user Identyfikator użytkownika, który ma zostać dodany do czarnej listy.
 * @param $token           Token bezpieczeństwa chroniący przez atakiem typu CSRF.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function AddToBlackList($id_blocked_user, $token)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if (!IsAccountExists($id_blocked_user)) {
		throw new ExceptionInvalidData();
	}
	
	$id_blocked_user = intval($id_blocked_user);
	
	// Data verifiction
	if ($id_blocked_user == $_SESSION['id']) {
		throw new ExceptionInvalidData('Samego siebie zablokować nie możesz! :)');
	}
	
	$query = 'INSERT INTO '.$database_prefix.'_blacklist
                      SET id_user = '.$_SESSION['id'].',
                          id_blocked_user = '.$id_blocked_user;
	$result = RunQuery($query);
	
	if (!$result) {
		if (mysql_errno() != 1062) {
			throw new ExceptionSQL();
		}
	}
	
	// Refreshing cache
	try {
		GetUserBlackList();
	} catch (ExceptionNoResults $e) {
	}
	
}

/**
 * Usuwa użytkownika o podanym identyfikatorze z czarnej list aktualnie zalogowanego użytkownika.
 * @param $id_blocked_user Identyfikator użytkownika, który ma zostać usunięty z czarnej listy aktualnie zalogowanego
 *                         użytkownika.
 * @param $token           Token bezpieczeństwa chroniący przez atakiem typu CSRF.
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function DeleteFromBlackList($id_blocked_user, $token)
{
	global $database_handle, $database_prefix, $database_handle;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if (!IsAccountExists($id_blocked_user)) {
		throw new ExceptionInvalidData();
	}
	
	$id_blocked_user = intval($id_blocked_user);
	
	$query = 'DELETE FROM '.$database_prefix.'_blacklist
                  WHERE id_user = '.$_SESSION['id'].'
                    AND id_blocked_user = '.$id_blocked_user;
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	// Refreshing cache
	try {
		GetUserBlackList();
	} catch (ExceptionNoResults $e) {
	}
}

/**
 * Testuje czy użytkownik o podanym jako parametr identyfikatorze jest już na czarnej liście użytkownika o podanym jako
 * drugi parametr identyfikatorze.
 * @param      $id_blocked_user Identyfikator użytkownika, którego chcemy sprawdzić.
 * @param int  $id_user         Identyfikator właściciela czarnej listy.
 * @param bool $refresh_cache   Określa czy cache ma zostać odświeżone przed sprawdzeniem, czy nie. Cache w niektórych
 *                              przypadkach może fałszować wyniki.
 * @return bool Zwraca True jeśli użytkownik jest blokowany u użytkownika o identyfikatorze $id_user i False w
 *                              przeciwnym przypadku.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function IsInUserBlacklist($id_blocked_user, $id_user = -1, $refresh_cache = false)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$id_blocked_user = intval($id_blocked_user);
	$id_user = intval($id_user);
	if ($id_user == -1) {
		$id_user = $_SESSION['id'];
	}
	
	// If we check relations ship between two other users
	if (($id_user != $_SESSION['id']) || ($refresh_cache)) {
		$query = 'SELECT COUNT(*) AS is_blocked
                FROM '.$database_prefix.'_blacklist
               WHERE id_user = '.$id_user.'
                 AND id_blocked_user = '.$id_blocked_user;
		$result = RunQuery($query);
		if (!$result) {
			throw new ExceptionSQL();
		}
		
		$row = mysql_fetch_assoc($result);
		
		return $row['is_blocked'] > 0;
	} else // if we check relation between session user and other user
	{ // we can use cached list
		
		// You cant block yourself
		if ($id_blocked_user == $_SESSION['id']) {
			return false;
		}
		
		foreach ($_SESSION['blacklist'] as $element) {
			if ($element['id'] == $id_blocked_user) {
				return true;
			}
		}
		return false;
	}
}

/**
 * Zwraca ostatnich rozmówców w komuniaktorze.
 * @return array
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function GetMyLastInterlocutors()
{
	global $database_handle, $database_prefix;
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$query = 'SELECT '.$database_prefix.'_conversation.id,
                   id_user_recipient,
                   user_recipient.login AS login_recipient,
                   user_recipient.sex AS sex_recipient
              FROM '.$database_prefix.'_conversation
         LEFT JOIN '.$database_prefix.'_users AS user_recipient
                ON '.$database_prefix.'_conversation.id_user_recipient = user_recipient.id
             WHERE
                   id_user_sender = '.$_SESSION['id'].'
          GROUP BY id_user_recipient
            ORDER BY '.$database_prefix.'_conversation.id';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$array = array();
	while ($row = mysql_fetch_assoc($result)) {
		$array[] = array(
			'id' => $row['id'],
			'login_recipient' => $row['login_recipient'],
			'sex_recipient' => $row['sex_recipient'],
			'id_user_recipient' => $row['id_user_recipient']
		);
		
	}
	return $array;
	
}

/**
 * Wyciąga listę wiadomości komunikatora.
 * Receives list of meesages
 * if $id_user_interlocutor == 0 then there will be received messages from all of interlocutors
 * if $id_last_message == -1 then there will be received only new messages (these from the last receiving)
 * @param $id_last_message
 * @param $id_user_interlocutor
 * @param $update_last_downloaded_message_id
 * @param $token Token bezpieczeństwa chroniący przez atakiem typu CSRF.
 * @return array
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function ReceiveConversationsWithUser(
	$id_last_message,
	$id_user_interlocutor,
	$update_last_downloaded_message_id,
	$token
) {
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if ($id_user_interlocutor != 0) {
		if (!IsAccountExists($id_user_interlocutor)) {
			throw new ExceptionInvalidData();
		}
	}
	
	// Variables filtration
	$id_last_message = intval($id_last_message);
	$id_user_interlocutor = intval($id_user_interlocutor);
	$update_last_downloaded_message_id = ($update_last_downloaded_message_id == 'false' ? false : ($update_last_downloaded_message_id == 'true' ? true : ($update_last_downloaded_message_id ? true : false)));
	
	if ($id_last_message == -1) { // receiving only new messages
		$SQL_id_last_message = '(user_this.id_last_downloaded_message)';
	} else { // Normal operation
		$SQL_id_last_message = $id_last_message;
	}
	
	$query = 'SELECT '.$database_prefix.'_conversation.id,
                   id_user_sender,
                   user_sender.login AS login_sender,
                   id_user_recipient,
                   user_recipient.login AS login_recipient,
                   message_text,
                   date
              FROM '.$database_prefix.'_conversation
         LEFT JOIN '.$database_prefix.'_users AS user_sender
                ON '.$database_prefix.'_conversation.id_user_sender = user_sender.id
         LEFT JOIN '.$database_prefix.'_users AS user_recipient
                ON '.$database_prefix.'_conversation.id_user_recipient = user_recipient.id
         LEFT JOIN '.$database_prefix.'_users AS user_this
                ON user_this.id = '.$_SESSION['id'].'
             WHERE (
                     (
                     id_user_sender = '.($id_user_interlocutor == 0 ? 'id_user_sender' : $id_user_interlocutor).'
                     AND
                     id_user_recipient = '.$_SESSION['id'].'
                     )
                 OR
                     (
                     id_user_sender = '.$_SESSION['id'].'
                     AND
                     id_user_recipient = '.($id_user_interlocutor == 0 ? 'id_user_recipient' : $id_user_interlocutor).'
                     )
                   )
                 AND
                   (
                     '.$database_prefix.'_conversation.id > '.$SQL_id_last_message.'
                   )
            ORDER BY '.$database_prefix.'_conversation.id';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	$array = array();
	$last_received_message_id = 0;
	while ($row = mysql_fetch_assoc($result)) {
		$array[] = array(
			'id' => $row['id'],
			'id_user_sender' => $row['id_user_sender'],
			'login_sender' => $row['login_sender'],
			'id_user_recipient' => $row['id_user_recipient'],
			'login_recipient' => $row['login_recipient'],
			'message_text' => $row['message_text'],
			'date' => $row['date']
		);
		
		if ($last_received_message_id < $row['id']) {
			$last_received_message_id = $row['id'];
		}
	}
	
	if ($update_last_downloaded_message_id) {
		// Updating last received message ID
		$query = 'UPDATE LOW_PRIORITY '.$database_prefix.'_users
                 SET id_last_downloaded_message = '.$last_received_message_id.'
               WHERE id = '.$_SESSION['id'].'
                 AND id_last_downloaded_message < '.$last_received_message_id;
		$result = RunQuery($query);
		if (!$result) {
			throw new ExceptionSQL();
		}
	}
	
	return $array;
	
}

/**
 * Wysyła wiadomość do innego użytkownika za pomocą komunikatora.
 * @param $id_user_recipient
 * @param $message
 * @param $token
 * @throws ExceptionAccessDenied
 * @throws ExceptionInvalidData
 * @throws ExceptionInvalidToken
 * @throws ExceptionSQL
 */
function SendMessageToUser($id_user_recipient, $message, $token)
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	if (!IsTokenValid($token)) {
		throw new ExceptionInvalidToken();
	}
	if (!IsAccountExists($id_user_recipient)) {
		throw new ExceptionInvalidData();
	}
	if (IsInUserBlacklist($_SESSION['id'], $id_user_recipient,
		true)) {
		throw new ExceptionAccessDenied('Nie możesz wysłać wiadomości do tego użytkownika, ponieważ figurujesz na jego czarnej liście.');
	}
	
	$id_user_recipient = intval($id_user_recipient);
	$message = addslashes(htmlspecialchars($message));
	if ($message == '') {
		throw new ExceptionInvalidData();
	}
	
	// Data verifiction
	if ($id_user_recipient == $_SESSION['id']) {
		throw new ExceptionInvalidData('Wysyłanie wiadomości do samego siebie jest dziwne i nie jest obsługiwane.');
	}
	
	$query = 'INSERT INTO '.$database_prefix.'_conversation
                      SET id_user_sender = '.$_SESSION['id'].',
                          id_user_recipient = '.$id_user_recipient.',
                          message_text = "'.$message.'"';
	$result = RunQuery($query);
	
	if (!$result) {
		if (mysql_errno() != 1062) {
			throw new ExceptionSQL();
		}
	}
}

/**
 * Wyświetla ostatnich rozmówców komunikatora.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function DisplayMyLastInterlocutors()
{
	global $database_handle, $database_prefix, $directory, $path;
	
	if ($_SESSION['account_type'] < USER) {
		throw new ExceptionAccessDenied();
	}
	
	$last_conversations = GetMyLastInterlocutors();
	
	echo('<ul id="last_conversations">');
	foreach ($last_conversations as $row) {
		if ($row['sex_recipient'] == SEX_FEMALE) {
			$img_sex = '<img src="'.$directory['design'].'icon_female.png" alt="Kobieta" title="Kobieta" />';
		} else {
			$img_sex = '<img src="'.$directory['design'].'icon_male.png" alt="Mężczyzna" title="Mężczyzna" />';
		}
		
		echo('
    <li class="user_block" onclick="location.href=jQuery(this).find(\'a\').attr(\'href\');">
      '.$img_sex.' <a href="'.$path['conversation'].'-'.$row['login_recipient'].'">'.$row['login_recipient'].'</a>
    </li>
    ');
		
	}
	echo('</ul>');
	
}

/**
 * Wysyła e-mail z wiadomością kontaktową pod podany jako parametr e-mail. Jest używana do powiadamiania nieobecnych
 * użytkowników o tym, że ktoś do nich napisał w komuniaktorze.
 * @param $email
 * @param $content
 * @return bool
 * @throws ExceptionEmailFormatInvalid
 * @throws ExceptionInvalidData
 */
function SendContactMessage($email, $content)
{
	global $kontakt_email, $service_name;
	
	if (!isEmailFormatValid($email)) {
		throw new ExceptionEmailFormatInvalid();
	}
	if ($content == '') {
		throw new ExceptionInvalidData('Pole treści wiadomości jest puste.');
	}
	
	$email = addslashes(htmlspecialchars(trim($email)));
	$content = addslashes(htmlspecialchars(trim($content)));
	
	$additional_headers = 'From: '.$service_name.' (formularz kontaktowy) <'.$kontakt_email.'>'."\r\n";
	$additional_headers .= 'Reply-To: '.$email."\r\n";
	$additional_headers .= 'MIME-Version: 1.0'."\r\n";
	$additional_headers .= 'Content-type: text/html; charset=UTF-8'."\r\n";
	
	$content = '<div style="border:10pt solid #CCCCCC; background:#CCCCCC; color:white;">Adres kontaktowy, podany przez użytkownika: '.$email."</div>\r\n<br />\r\n<p>".$content."</p>";
	
	return mail($kontakt_email, 'Wiadomosc kontaktowa', $content, $additional_headers);
}

/**
 * Wyświetla listę adresów e-mail użytkowników serwisu.
 * @throws ExceptionAccessDenied
 * @throws ExceptionSQL
 */
function DisplayUsersEmailsList()
{
	global $database_handle, $database_prefix;
	
	if ($_SESSION['account_type'] < ADMINISTRATOR) {
		throw new ExceptionAccessDenied();
	}
	
	$query = 'SELECT login, name, surname, email
              FROM '.$database_prefix.'_users';
	$result = RunQuery($query);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	
	echo('<textarea cols="80" rows="25">');
	while ($row = mysql_fetch_assoc($result)) {
		if ($row['email'] == '') {
			continue;
		}
		if ($row['login'] == ACCOUNT_NAME_IN_PLACE_OF_REMOVED_ACCOUNT) {
			continue;
		}
		
		if ($row['name'] == '') {
			$name = $row['login'];
		} else {
			$name = $row['name'].' '.$row['surname'];
		}
		
		echo($name.' &lt;'.$row['email'].'&gt;;'."\r\n");
	}
	echo('</textarea>');
	
	
}

/**
 * Wyświetla formularz logowania.
 * @param bool $version_mini
 */
function DisplayFormLogin($version_mini = false)
{
	global $directory, $path, $service_base_address;
	
	if ($version_mini) {
		echo('
        <form action="'.$path['login'].'" method="post">
          <input type="text" id="login" name="login" value="Login lub e-mail" size="13" />
          <input type="password" id="password" name="password" value="Hasło" size="13" />
          <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
          <button type="submit" name="buttonLogin" class="button_cold">Zaloguj się</button>
        </form>
    ');
	} else {
		if (isset($_POST['login']) && isset($_POST['password'])) {
			if ($_SESSION['account_type'] < USER) {
				echo('<div class="ajax_negative" style="width:98%">Błędny login lub hasło.</div>');
			}
		}
		
		echo('
       <form action="'.$path['login'].'" method="post" name="login_form2" class="uniform_labels login_page">
        <fieldset>
          <label for="login">Login:</label><input type="text" name="login" id="login" size="24" style="width:40%;" /><br />
          <label for="password">Hasło:</label><input type="password" name="password" id="password" size="12" style="width:40%;" />
          <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
          <button name="buttonLogin" type="submit" class="przycisk" style="margin-left:220px; margin-top:15px; width:230px;">Zaloguj</button>
          <br />
          <input type="checkbox" name="pamietaj_sesje" id="pamietaj_sesje" />
          <label for="pamietaj_sesje" style="width:60%"> Pamiętaj mnie na tym komputerze</label>
        </fieldset>
      </form>

      <div class="additional_login_options">
       Nie masz jeszcze konta? <strong><a href="'.$path['register'].'">Załóż je za darmo!</a></strong><br />
          <a href="'.$path['remember_password'].'">Nie pamiętasz hasła?</a><br />
          <a href="'.$path['send_activation_email_again'].'">Nie dotarł list z linkiem aktywacyjnym?</a><br />
          <a href="'.preg_replace('|http|', 'https', $service_base_address, 1).'">Przejdź na szyfrowane połączenie</a><br />
      </div>

      <br style="clear:both" />

      <script type="text/javascript">
      //<![CDATA[
      jQuery(document).ready(function (){
        jQuery(".uniform_labels #login").focus();
      });
      //]]>
      </script>
    ');
	}
}

/**
 * Wstawia skrypt o podanej nazwie na stronę.
 * @param $name_of_script
 */
function JavaScriptZaladujSkrypt($name_of_script)
{
	global $directory, $path;
	
	$name_of_script = addslashes(htmlspecialchars($name_of_script));
	
	switch ($name_of_script) {
		case 'fancybox':
			echo('
      <script type="text/javascript" src="'.$directory['scripts_fancybox'].'jquery.fancybox.js"></script>
      <link rel="stylesheet" href="'.$directory['scripts_fancybox'].'jquery.fancybox.css" />
      ');
			break;
		
		case 'swfobject':
			echo('<script type="text/javascript" src="'.$directory['scripts'].'swfobject.js"></script>');
			break;
		
		case 'smartfox':
			echo('<script type="text/javascript" src="'.$directory['scripts'].'sfs2x-api.js"></script>');
			break;
		
		case 'sha1':
			echo('<script type="text/javascript" src="'.$directory['scripts'].'jquery.sha1.js"></script>');
			break;
		
		case 'infinitecarousel':
			echo('<script type="text/javascript" src="'.$directory['scripts_infinite_carousel'].'jquery.infinitecarousel.min.js"></script>');
			break;
		
		case 'example':
			echo('<script type="text/javascript" src="'.$directory['scripts_example'].'jquery.example.min.js"></script>');
			echo('
      <script type="text/javascript">
      //<![CDATA[
       jQuery(".pole_z_przykladem").example(function () { return jQuery(this).attr("title"); });
      //]]>
      </script>');
			break;
		
		default:
			echo('Nie udało się załadować skryptu &quot;'.$name_of_script.'&quot;.');
			break;
	}
}


// Postanowiłem podzielić nieco plik library_main.php na mniejsze części. Póki co, podzielę go, a później być może uda się dynamicznie dołączać te części w zależności czego dany moduł potrzebuje - bo bez sensu jest dołączać np. funkcje obsługi albumów gdy chcemy np. jedynie zmienić status konta.

// Dołączanie bibliotek odpowiedzialnych za konkretne moduły
include($path['library_games']);
include($path['library_facebook']);
