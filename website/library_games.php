<?php

/**
 * Wyświetla formularz dodawania nowej gry.
 * @param     $nazwa_kontrolki string Ciąg tekstowy poprzedzający nazwę pól formularza (prefix).
 * @param int $domyslnie_zaznaczona_kategoria
 */
function GryWyswietlFormularzDodawaniaGry($nazwa_kontrolki, $domyslnie_zaznaczona_kategoria=-1)
{
  $nazwa_kontrolki = htmlspecialchars($nazwa_kontrolki);
  $domyslnie_zaznaczona_kategoria = intval($domyslnie_zaznaczona_kategoria);

  echo('
  <form action="" enctype="multipart/form-data" method="post">
    <fieldset class="kontrolki_formularza_na_cala_szerokosc rownomierny_uklad_kontrolek formularz_obramowany">
       <legend>Dodawanie nowej gry</legend>
       <label for="'.$nazwa_kontrolki.'_title">Tytuł gry</label>
       <input type="text" name="'.$nazwa_kontrolki.'_title" id="'.$nazwa_kontrolki.'_title" /><br />

       <label for="'.$nazwa_kontrolki.'_directory_name">Skrócona nazwa gry (małymi literami, bez spacji,będzie nazwą katalogu)</label>
       <input type="text" name="'.$nazwa_kontrolki.'_directory_name" id="'.$nazwa_kontrolki.'_directory_name" /><br />

       <label for="'.$nazwa_kontrolki.'_kategoria">Kategoria</label>
       <select name="'.$nazwa_kontrolki.'_kategoria" id="'.$nazwa_kontrolki.'_kategoria">
       ');
         GryZwrocKategorieGier($kategorie_gier);
         for ($i=0; $i<count($kategorie_gier); $i++)
         {
           if ($kategorie_gier[$i]['id']==$domyslnie_zaznaczona_kategoria)
           {
             $description = 'selected="selected"';
           }else
           {
             $description = '';
           }
           echo('<option value="'.$kategorie_gier[$i]['id'].'" '.$description.'>'.$kategorie_gier[$i]['title'].'</option>');
         }
       echo('
       </select>
       <br />

       <label for="'.$nazwa_kontrolki.'_game">Plik z grą</label>
       <input type="file" name="'.$nazwa_kontrolki.'_game" id="'.$nazwa_kontrolki.'_game" /><br />

       <label for="'.$nazwa_kontrolki.'_logo">Plik z logiem gry</label>
       <input type="file" name="'.$nazwa_kontrolki.'_logo" id="'.$nazwa_kontrolki.'_logo" /><br />

       <label for="'.$nazwa_kontrolki.'_description">opis gry</label>
       <textarea name="'.$nazwa_kontrolki.'_description" id="'.$nazwa_kontrolki.'_description" /><br />

       <input type="submit" name="'.$nazwa_kontrolki.'_ok" />
    </fieldset>
  </form>
  ');

}

/**
 * Odbiera plik z grą od użytkownika i zapisuje podanym folderze.
 * @param $directory_name
 * @param $nazwa_kontrolki_games
 * @param $nazwa_kontrolki_loga
 * @param $nowa_nazwa_games
 * @param $nowa_nazwa_loga
 * @return int
 */
function GryPrzyjmijIZapiszGre($directory_name, $nazwa_kontrolki_games, $nazwa_kontrolki_loga, &$nowa_nazwa_games, &$nowa_nazwa_loga)
{ // Adapter dla zdjęć
	global $galeria_zdjec_dozwolone_rozszerzenia, $directory;
	
	$directory_name = addslashes(htmlspecialchars($directory_name));
	
	$directory['zapisu'] = $directory['games'].$directory_name.'/';
	
	@mkdir($directory['zapisu']);
	$ok = PrzyjmijIZapiszPlik($nazwa_kontrolki_games, 0, array('swf'), $directory['zapisu'], $nowa_nazwa_games);
	
	// Przesyłanie błędów wyżej w hierarchii wywołań
	if ($ok != OK_WSZYSTKO) {
		return $ok;
	}


  $ok = PrzyjmijIZapiszPlik($nazwa_kontrolki_loga,0,$galeria_zdjec_dozwolone_rozszerzenia,$directory['zapisu'],$nowa_nazwa_loga);

  // Przesyłanie błędów wyżej w hierarchii wywołań
  if ($ok!=OK_WSZYSTKO) { return $ok; }

  return OK_WSZYSTKO;
}

/**
 * Dodaje do bazy danych grę o podanym tytule i instaluje ją serwisie.
 * @param $game_title
 * @param $directory_name
 * @param $id_category
 * @param $game_description
 * @param $filename_logo
 * @param $filename_game
 * @return int
 */
function GryDodajGre($game_title, $directory_name, $id_category, $game_description, $filename_logo, $filename_game)
{
  global $database_prefix;

  if ($_SESSION['account_type']<ADMINISTRATOR) { return BLAD_BRAK_UPRAWNIEN; }

  $game_title = addslashes(htmlspecialchars($game_title));
  $directory_name = addslashes(htmlspecialchars($directory_name));
  $id_category = intval($id_category);
  $game_description = addslashes(htmlspecialchars($game_description));
  $filename_logo = addslashes(htmlspecialchars($filename_logo));
  $filename_game = addslashes(htmlspecialchars($filename_game));

  $query = 'INSERT INTO '.$database_prefix.'_games
                        SET id_category = '.$id_category.',
                            title = "'.$game_title.'",
                            directory_name = "'.$directory_name.'",
                            description = "'.$game_description.'",
                            filename_logo = "'.$filename_logo.'",
                            filename_game = "'.$filename_game.'",
                            date_add = CURRENT_DATE(),
                            godzina_dodania = CURRENT_TIME()';
  $result = RunQuery($query);

  if ($result)
  {
    return OK_WSZYSTKO;
  }else
  {
    if (mysql_errno() == 1062)
      return OK_WSZYSTKO;
    else
      return BLAD_SQL;
  }

  return BLAD_NIEPRZEWIDZIANY;
}

/**
 * Zwraca (za pomocą referencji, do parametru) listę kategorii gier (jako tablicę).
 * @param $lista_kategorii
 * @return int
 */
function GryZwrocKategorieGier(&$lista_kategorii)
{
  global $database_prefix, $path;
	
	$query = 'SELECT id,
                       id AS tmp_id,
                       title,
                       description,
                       (SELECT COUNT(*) FROM '.$database_prefix.'_games WHERE id_category=tmp_id) AS ilosc_gier_w_kategorii
                  FROM '.$database_prefix.'_games_categories';
	RunQuery($query, false, $statement);

  $lista_kategorii = array();
	
	if (NumQueryRows($statement) > 0) {
		$zwroc = array();
		while ($wiersz = FetchQuery($statement)) {
			$lista_kategorii[] = $wiersz;
		}
	}
    return OK_WSZYSTKO;
	
}

/**
 * Wyciąga nazwę strefy do której należy gra o podanym identyfikatorze.
 * @param $id_game
 * @return mixed
 * @throws ExceptionSQL
 */
function GetGameZone($id_game)
{
  global $database_prefix;

  $id_game = intval($id_game);
	
	$query = 'SELECT zone_name
              FROM '.$database_prefix.'_games
             WHERE id='.$id_game;
	$wiersz = RunQuery($query);
  return $wiersz['zone_name'];
}

/**
 * Wyciąga informacje o grze o podanym jako parametr identyfikatorze.
 * @param $id_game
 * @return array
 * @throws ExceptionSQL
 */
function GetGameInfo($id_game)
{
  global $database_prefix;

  $id_game = intval($id_game);
	
	$query = 'SELECT title,
                   directory_name,
                   background_color,
                   zone_name,
                   description,
                   filename_logo,
                   filename_game,
                   date_add
              FROM '.$database_prefix.'_games
             WHERE id='.$id_game;
	$wiersz = RunQuery($query);
  return $wiersz;
}

/**
 * Wyświetla opcje pokoju dla gry o podanym identyfikatorze.
 * @param $id_game
 * @throws ExceptionSQL
 */
function DisplayRoomOptions($id_game)
{
  global $path, $directory;

  $id_game = intval($id_game);
  $game_info = GetGameInfo($id_game);

  // General script for SimpleRoomOptions class with standard functionality
  $script_path = $directory['scripts'].'/ScriptSimpleRoomOptions.js';
  echo('<script type="text/javascript" src="'.$script_path.'"></script>');

  // Script specific to game
  $script_path = $directory['games'].'/'.$game_info['directory_name'].'/ScriptRoomOptions.js';
  if (file_exists($script_path))
    echo('<script type="text/javascript" src="'.$script_path.'"></script>');

  $roomOptions = array(
    array(
      'type' => 'text',
      'name' => 'roomName',
      'title' => 'Wprowadź nazwę dla nowego stołu:',
      'state' => '',
      'size' => 35,
      'maxlength' => 15
    ),
    array(
      'type' => 'checkbox',
      'name' => 'gameNotInRank',
      'title' => 'Nie uwzględniaj w rankingu',
      'state' => ''
    ),
    array(
      'type' => 'select',
      'name' => 'roomVisibility',
      'title' => 'Wybierz widoczność stołu',
      'state' => 1,
      'items' => array(
        array( 'name'=>'Prywatny', 'value'=> 'PRIVATE' ),
        /*
        array( 'name'=>'Widoczny tylko dla graczy z min. 10 pkt.', 'value'=> '10' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 20 pkt.', 'value'=> '20' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 30 pkt.', 'value'=> '30' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 50 pkt.', 'value'=> '50' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 100 pkt.', 'value'=> '100' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 200 pkt.', 'value'=> '200' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 300 pkt.', 'value'=> '300' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 400 pkt.', 'value'=> '400' ),
        array( 'name'=>'Widoczny tylko dla graczy z min. 400 pkt.', 'value'=> '500' ),*/
        array( 'name'=>'Publiczny', 'value'=> 'PUBLIC' )
      )
    ),
    array(
      'type' => 'select',
      'name' => 'gameDuration',
      'title' => 'Określ czas gry przy tym stole',
      'state' => 2,
      'items' => array(
        array( 'name'=>'1 minuta', 'value'=> '60' ),
        array( 'name'=>'2 minuty', 'value'=> '120' ),
        array( 'name'=>'3 minuty', 'value'=> '180' ),
        array( 'name'=>'5 minut', 'value'=> '300' ),
        array( 'name'=>'6 minut', 'value'=> '360' ),
        array( 'name'=>'7 minut', 'value'=> '420' ),
        array( 'name'=>'15 minut', 'value'=> '900' ),
        array( 'name'=>'20 minut', 'value'=> '1200' ),
        array( 'name'=>'25 minut', 'value'=> '1500' ),
        array( 'name'=>'30 minut', 'value'=> '1800' )
      )
    ),
  );

  foreach($roomOptions as $value)
  {
    switch ($value['type'])
    {
      case 'select':
        echo('<br /><label for="'.$value['name'].'">'.$value['title'].'</label><br />');
        echo('<select name="'.$value['name'].'" id="'.$value['name'].'" selectedIndex="'.$value['state'].'">');
        $i = 0;
        foreach($value['items'] as $item)
        {
          $selected = ($i==$value['state'])?'selected':'';
          echo('<option value="'.$item['value'].'" '.$selected.'>'.$item['name'].'</option>');
          $i++;
        }

        echo('</select>');
      break;

      case 'checkbox':
        echo('<br /><input type="'.$value['type'].'" name="'.$value['name'].'" id="'.$value['name'].'" '.$value['state'].' >');
        echo('<label for="'.$value['name'].'">'.$value['title'].'</label>');
      break;

      case 'text':
        $size = $value['size']!=''?' size="'.$value['size'].'"':'';
        $maxlength = $value['maxlength']!=''?' maxlength="'.$value['maxlength'].'"':'';
        echo('<label for="'.$value['name'].'">'.$value['title'].'</label>');
        echo('<br /><input type="'.$value['type'].'" name="'.$value['name'].'" id="'.$value['name'].'" value="'.$value['state'].'" '.$size.' '.$maxlength.'>');
      break;

      default:
        echo('<input type="'.$value['type'].'" name="'.$value['name'].'" id="'.$value['name'].'" >');
        echo('<label for="'.$value['name'].'">'.$value['title'].'</label><br />');
      break;

    }
  }
}

/**
 * Zwraca nazwę kategorii o podanym identyfikatorze.
 * @param $id_category
 * @return string Nazwa kategorii o podanym identyfikatorze.
 */
function GryZwrocNazweKategorii($id_category)
{
	global $database_prefix, $path;
	
	$id_category = intval($id_category);
	
	$query = 'SELECT title
                  FROM '.$database_prefix.'_games_categories
                 WHERE id='.$id_category;
	$wiersz = RunQuery($query);
	return $wiersz['title'];
}


/**
 * Wyświetla listing kategorii gier.
 * @return bool|int
 */
function GryWyswietlKategorie()
{
  global $path;

  if ($kod_bledu=GryZwrocKategorieGier($kategorie_gier)!=OK_WSZYSTKO)
    return $kod_bledu;

  if (count($kategorie_gier)>0)
  {
    echo('<ul class="gry_kolumny">');
    for ($i=0; $i<count($kategorie_gier); $i++)
    {
      echo('<li><a href="'.$path['games'].'?id_category='.$kategorie_gier[$i]['id'].'">'.$kategorie_gier[$i]['title'].'</a> ('.$kategorie_gier[$i]['ilosc_gier_w_kategorii'].')
      </li>');
    }
    echo('</ul>');
    echo('
    <script type="text/javascript">
      jQuery(".gry_kolumny li").click(function (){
        location.href = jQuery(this).find("a").attr("href");
      });
    </script>
    ');
  }

  return OK_WSZYSTKO;
}

/**
 * Wyświetla listing gier w kategorii podanej jako parametr.
 * @param $id_category Identyfikator kategorii.
 * @return int
 */
function GryWyswietlPozycjeKategorii($id_category)
{
  global $database_prefix, $path, $directory;

//  if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }

  $id_category = intval($id_category);

  $query = 'SELECT     id,
                       id AS parent_query_id_game,
                       id_category,
                       (SELECT title
                          FROM '.$database_prefix.'_games_categories
                         WHERE id = '.$id_category.'
                       ) AS title_kategorii,
                       title,
                       description,
                       directory_name,
                       filename_logo,
                       filename_game,
                       date_add
                  FROM '.$database_prefix.'_games
                 WHERE id_category = '.$id_category.'
                   AND hide = false';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) > 0) {
		$HTML = '<ul class="gry_pozycje">';
		while ($wiersz = FetchQuery($statement)) {
			$title_kategorii = $wiersz['title_kategorii'];
			$HTML .= '<li>
          <h2><a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">'.$wiersz['title'].'</a></h2>
          <p>
            ';
			if (file_exists($directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'])) {
				$HTML .= '<a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'"><img src="'.$directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'].'" alt="Logo gry" style="float:left"/></a>';
			}
          $statystyka = GryZwrocStatystyki($wiersz['id']);
          $HTML .= '
          </p>
          <div class="column_right">
            '.nl2br(stripslashes($wiersz['description'])).'

            <div class="actual_game_statistics">
              Teraz grających: '.$statystyka['active_players_count'].' <span>&bull;</span> Unikalnych graczy: '.$statystyka['unique_players_count'].' <span>&bull;</span> Rozgrywek: '.$statystyka['counter_plays'].'
            </div>
          </div>
          <br style="clear:both" />
        </li>';
      }
      $HTML .= '</ul>';

      echo('<h1><a href="'.$path['games'].'">Katalog gier</a> &bull; <a href="'.$path['games'].'?id_category='.$id_category.'">'.$title_kategorii.'</a></h1>');
      echo $HTML;
    }else
    {
      echo('<h2><a href="'.$path['games'].'">Katalog gier</a></h2>
      <div class="uwaga">W tej kategorii nie ma jeszcze żadnych gier.</div>

      <a href="'.$path['games'].'">&laquo; Przejdź do spisu kategorii gier</a>
      ');
    }
    return OK_WSZYSTKO;
	
}

/**
 * Wyświetla grę o identyfikatorze podanym jako parametr. Dołącza do pokoju podanym jako parametr.
 * @param $id_game
 * @param $roomName
 * @param $gameNotInRank
 * @param $roomVisibility
 * @param $gameDuration
 * @return int
 */
function GryWyswietlGre($id_game, $roomName, $gameNotInRank, $roomVisibility, $gameDuration)
{
  global $database_prefix, $path, $directory;

  //if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }

  $id_game = intval($id_game);
  $roomName = addslashes(htmlspecialchars($roomName));
  $gameNotInRank = $gameNotInRank=='on'?true:false;
  $roomVisibility = addslashes(htmlspecialchars($roomVisibility));
  $gameDuration = intval($gameDuration);

  $query = 'SELECT id,
                       id_category,
                       (SELECT title
                          FROM '.$database_prefix.'_games_categories
                         WHERE id = id_category
                       ) AS title_kategorii,
                       title,
                       description,
                       directory_name,
                       background_color,
                       hide,
                       filename_game,
                       filename_logo,
                       date_add
                  FROM '.$database_prefix.'_games
                 WHERE id = '.$id_game;
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) > 0) {
		$wiersz = FetchQuery($statement);
		$HTML = '';
		if ($wiersz['hide'] == 1) {
			$HTML .= '<div class="warning">Ta gra jest ukryta na liście gier.</div>';
		}
		
		
		$extension = pathinfo($wiersz['filename_game'], PATHINFO_EXTENSION);
		$gameParameters = $wiersz;
		$gameParameters['roomName'] = $roomName;
      $gameParameters['gameNotInRank'] = $gameNotInRank;
      $gameParameters['roomVisibility'] = $roomVisibility;
      $gameParameters['gameDuration'] = $gameDuration;

      switch ($extension){
        case 'swf':
          $HTML .= emdedFlashGame($gameParameters);
          break;
        case 'js':
          $HTML .= emdedHtml5Game($gameParameters);
          break;
        default:
          $HTML .= 'Nieobsługiwany typ zawartości do wyświetlenia.';
          break;
      }
    }

    echo('<h1 id="path"><a href="'.$path['games'].'">Katalog gier</a> &bull; <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'">'.$wiersz['title_kategorii'].'</a> &bull; <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">'.$wiersz['title'].'</a></h1>');
    echo $HTML;

    return OK_WSZYSTKO;
}


function emdedFlashGame($gameParameters)
{
  global $path, $directory;
  $HTML = '
      <script type="text/javascript">
      //<![CDATA[
        var gameStarted = false;
        var flashvars = { roomName:"'.$gameParameters['roomName'].'", gameNotInRank: '.($gameParameters['gameNotInRank']?'true':'false').', roomVisibility:"'.$gameParameters['roomVisibility'].'", gameDuration: "'.$gameParameters['gameDuration'].'", PHPSESSID:"'.session_id().'"  };
        var params = { swliveconnect:"true", scale:"showall", bgcolor:"'.$gameParameters['background_color'].'", allowFullScreen:"true", allowFullScreenInteractive:"true", allowscriptaccess:"sameDomain", wmode:"transparent", base:"'.$directory['games'].$gameParameters['directory_name'].'/" };
        var attributes = { id:"flashContent", name:"'.$gameParameters['directory_name'].'" };

        var fpver = "11.3";
        if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)){ //test for MSIE x.x;
          fpver = "10.0";
        }

        function callbackFn(e) {
          if(!e.success) {
            var r=confirm("game do poprawnego działania wymaga oprogamemowania Adobe Flash Player. Aby zainstalować, naciśnij OK.");
            if (r) {
              window.location.href = "http://get.adobe.com/pl/flashplayer/";
            }
          }
        }

        function f(){
          if(gameStarted)
            if(confirm(\'Czy na pewno chcesz zamknąć okno z grą?\')){ return false; return true; }
        }

        function openPopup() {
          var ua = navigator.userAgent.toLowerCase();
          if (ua.indexOf(\'safari\')!=-1 && ua.indexOf(\'chrome\')  == -1){
            window.open(\'index_pop.html\', \'_blank\', \'width=920,height=560,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes,top=0,left=0\');
          }else{
            window.open(\'index_pop.html\', \'_blank\', \'width=920,height=620,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes,top=0,left=0\');
          }
          return false;
        }

        function setGameStarted(isStarted) {
          gameStarted = isStarted;
        }

        function gotoRoomsList() {
          location.href = "'.$path['games'].'?id_category='.$gameParameters['id_category'].'&id_game='.$gameParameters['id'].'";
        }

        window.onbeforeunload = function() {
          if(gameStarted){
            return "Próbujesz zamknąć okno, w którym toczy się gra.";
          }
        }

        jQuery(document).ready(function ()
        {
          swfobject.embedSWF("'.$directory['games'].$gameParameters['directory_name'].'/'.$gameParameters['filename_game'].'?reload_browser_cache_trick='.date('i').'", "game", "960", "650", fpver, "expressInstall.swf", flashvars, params, attributes, callbackFn);

          // Usuwanie tradycyjnie osadzonego flasha
          jQuery("#game_bez_javascript").empty();
        });


      //]]>
      </script>

      <div id="game">
        <!-- Pojemnik wypełniany JavaScriptem -->

        <!-- Pojemnik z tradycyjnym flashem (ten węzeł DOM zostaje usunięty gdy JavaScript jest active) -->
        <div class="no_javascript" id="game_bez_javascript">
          <object width="960" height="650" data="'.$directory['games'].$gameParameters['directory_name'].'/'.$gameParameters['filename_game'].'?reload_browser_cache_trick='.date('i').'" type="application/x-shockwave-flash">
            <param name="movie" value="'.$directory['games'].$gameParameters['directory_name'].'/'.$gameParameters['filename_game'].'" />
            <param name="swliveconnect" value="true" />
            <param name="scale" value="showall" />
            <param name="bgcolor" value="'.$gameParameters['background_color'].'" />
            <param name="allowFullScreen" value="true" />
            <param name="allowFullScreenInteractive" value="true" />
            <param name="allowscriptaccess" value="sameDomain" />
            <param name="wmode" value="transparent" />
            <param name="base" value="'.$directory['games'].$gameParameters['directory_name'].'/" />

            <param name="flashvars" value="" />
            <!--[if !IE]>
            <object data="'.$directory['games'].$gameParameters['directory_name'].'/'.$gameParameters['filename_game'].'?reload_browser_cache_trick='.date('i').'" width="960" height="650" type="application/x-shockwave-flash">
              <param name="swliveconnect" value="true" />
              <param name="scale" value="showall" />
              <param name="bgcolor" value="'.$gameParameters['background_color'].'" />
              <param name="allowFullScreen" value="true" />
              <param name="allowFullScreenInteractive" value="true" />
              <param name="allowScriptAccess" value="sameDomain" />
              <param name="wmode" value="transparent" />
              <param name="base" value="'.$directory['games'].$gameParameters['directory_name'].'/" />
              <param name="pluginurl" value="http://www.macromedia.com/go/getflashplayer" />

              <param name="flashvars" value="roomName='.$gameParameters['roomName'].'&PHPSESSID='.session_id().'" />

              <p>Nie można uruchomić gry, ponieważ nie posiadasz zainstalowanego plug-inu Flash. Zainstaluj plugin i spróbuj ponownie. Jego najnowszą wersję znajdziesz zawsze pod adresem <a href="http://www.macromedia.com/go/getflashplayer">http://www.macromedia.com/go/getflashplayer</a></p>
            </object>
            <![endif]-->

          </object>
        </div>
      </div>

      <img src="'.$directory['design'].'Powered_by_SFS2X_logo.png" alt="Powered by Smartfox Server" style="float:right" /><br />

      ';

  return $HTML;
}

function emdedHtml5Game($gameParameters)
{
  global $path, $directory;
  $HTML = '
      <script type="text/javascript">
      //<![CDATA[
        var gameParameters = { roomName:"'.$gameParameters['roomName'].'", 
                               gameNotInRank: '.($gameParameters['gameNotInRank']?'true':'false').', 
                               roomVisibility:"'.$gameParameters['roomVisibility'].'", 
                               gameDuration: "'.$gameParameters['gameDuration'].'", 
                               gameId: '.$gameParameters['id'].',
                               categoryId: '.$gameParameters['id_category'].',
                               categoryTitle: "'.$gameParameters['title_kategorii'].'",
                               gameTitle: "'.$gameParameters['title'].'",
                               directoryName: "'.$gameParameters['directory_name'].'",
                               backgroundColor: "'.$gameParameters['background_color'].'",
                               hide: "'.($gameParameters['hide']==1?true:false).'",
                               gameFilename: "'.$gameParameters['filename_game'].'",
                               gameLogoFilename: "'.$gameParameters['filename_logo'].'",
                               dateAdd: "'.$gameParameters['date_add'].'",
                               PHPSESSID:"'.session_id().'" 
                             };
                             
  ';

  $HTML .= '
      </script>
            
      <canvas id="gameboard" width="960" height="650">
        Twoja przeglądarka nie obsługuje elementu Canvas (HTML5). Zaktualizuj ją, aby móc uruchomić grę.
      </canvas>     
 
      <script type="text/javascript" src="'.$directory['games'].$gameParameters['directory_name'].'/'.$gameParameters['filename_game'].'"></script>
      ';
  return $HTML;
}

/**
 * Wyświetla opis gry o identyfikatorze podanym jako parametr.
 * @param $id_game Identyfikator gry.
 * @return int
 */
function GryWyswietlOpisGry($id_game)
{
  global $database_prefix, $path, $directory;

  //if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }

  $id_game = intval($id_game);

  $query = 'SELECT id,
                       id_category,
                       (SELECT title
                          FROM '.$database_prefix.'_games_categories
                         WHERE id = id_category
                       ) AS title_kategorii,
                       title,
                       description,
                       directory_name,
                       filename_game,
                       filename_logo,
                       date_add
                  FROM '.$database_prefix.'_games
                 WHERE id = '.$id_game;
	RunQuery($query, false, $statement);
	
	
	if (NumQueryRows($statement) > 0) {
		$wiersz = FetchQuery($statement);
		$HTML = '
      <p class="gry_pozycje">
      ';
		if (file_exists($directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'])) {
			$HTML .= '<img src="'.$directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'].'" alt="Logo gry" />';
		}
		
		$HTML .= '
        '.nl2br(stripslashes($wiersz['description'])).'
      </p>
      ';
    }

    echo('<h1><a href="'.$path['games'].'">Katalog gier</a> &bull; <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'">'.$wiersz['title_kategorii'].'</a> &bull; <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">'.$wiersz['title'].'</a></h1>');
    echo $HTML;
    echo('<br style="clear:both;" />');

    return OK_WSZYSTKO;

}


/**
 * Wyświetla pokoje rogrywek dla gry o podanym identyfikatorze.
 * @param $id_category Identyfikator kategorii.
 * @param $id_game Identyfikator gry.
 * @throws ExceptionSQL
 */
function GryWyswietlPokojeDlaGry($id_category, $id_game)
{
  global $smartfox_address, $smartfox_port, $directory, $path;
  $id_game = intval($id_game);
  $id_category = intval($id_category);
  //JavaScriptZaladujSkrypt('smartfox');
  JavaScriptZaladujSkrypt('sha1');
  $game_info = GetGameInfo($id_game);

  echo('
  <div id="connection_status">Rozłączony</div>
  <button id="goto_category_list">&lt;&lt; Wstecz</button>
  <button id="create_room">Nowy stół do gry</button>
  <div id="no_websocket_support_warning">Twoja przeglądarka nie obsługuje technologii WebSocket wykorzystywanej przez nasz serwis. Zaktualizuj przeglądarkę, aby zagrać w gry.</div>
  <br />
  <h1>'.$game_info['title'].'</h1>

  <div id="roomCreateOptions" style="display:none">
    <form method="post">
      <div class="invalidData">Wprowadzona nazwa stołu jest nieprawidłowa. Nazwa nie może być pusta, a jej długość musi mieścić się w przedziale od 4 do 15 znaków.</div>
      ');
    DisplayRoomOptions($id_game);
    echo('
    </form>
  </div>

  <div id="roomListContainer"></div>
  <div id="userListContainer"></div>
  <br style="clear:both" />

  <script type="text/javascript">
    // Wykrywanie WebSockets
    if (!window.WebSocket) jQuery("#no_websocket_support_warning").slideDown();
  </script>

  <script type="text/javascript">
    var link_dolaczania_do_pokoju = "'.$path['games'].'?id_category='.$id_category.'&id_game='.$id_game.'&";
    var zoneName = "'.$game_info['zone_name'].'";
    var container = "#roomListContainer";
    var userListContainer = "#userListContainer";

    // Create configuration object
    var config = {};
    config.host = "'.$smartfox_address.'";
    config.port = '.$smartfox_port.';
    config.zone = zoneName;
    config.debug = false;

    var smartFox = new SFS2X.SmartFox(config);

    function connect()
    {
      if (smartFox.isConnected) return;
      smartFox = new SFS2X.SmartFox(config);

      if (WebSocket){
        displayRoomListLoader("Proszę czekać, trwa łączenie z serwerem gier...");
        displayUserListLoader("Proszę czekać, trwa łączenie z serwerem gier...");
      }else {
        displayRoomListLoader("Nie można połączyć z serwerem gier.");
        displayUserListLoader("Nie można połączyć z serwerem gier.");
        if (console)
          console.log(exception.message);
        return;
      }

      // Set client details
      var platform = navigator.appName;
      var version = navigator.appVersion;
      smartFox.setClientDetails(platform, version);
      smartFox.connect();
      
      smartFox.addEventListener(SFS2X.SFSEvent.CONNECTION, onConnection, this);
      smartFox.addEventListener(SFS2X.SFSEvent.CONNECTION_LOST, onDisconnect, this);
      smartFox.addEventListener(SFS2X.SFSEvent.LOGIN, onLogin, this);
      smartFox.addEventListener(SFS2X.SFSEvent.LOGIN_ERROR, onLoginError, this);
      smartFox.addEventListener(SFS2X.SFSEvent.USER_COUNT_CHANGE, onUserCountChange, this);
      smartFox.addEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onExtensionResponse, this);

      if (console)
        console.log("SmartFox API version: " + smartFox.version);
    }

    function onUserCountChange(evtParams)
    {
      var room = evtParams.room;
      var sCount = evtParams.sCount;
      var uCount = evtParams.uCount;
      displayRoomList();
    }

    function displayUsersInRoom()
    {
      var list = jQuery(userListContainer).find("tbody .login");
      var connectedLogins = "";
      for(i=0; i<list.length; i++) { connectedLogins += jQuery(list[i]).attr("login"); }
      var param = { "hash": jQuery.sha1(connectedLogins) };
      smartFox.send(new SFS2X.ExtensionRequest("getAllUsers", param));
    }

    function onUsersListReceived(event)
    {
      var table = jQuery(userListContainer).find("tbody");
      if (table.length==0){
        jQuery(userListContainer).html("<table><thead><tr><th></th><th>Gracz</th><th>Punkty</th><th>Miejsce</th></tr></thead><tbody></tbody></table>");
        table = jQuery(userListContainer).find("tbody");
      }

      var probablyOutdatedListOfUsers = jQuery(table).find("td.login");
      for(i=0; i<probablyOutdatedListOfUsers.length; i++)
      {
        // checking if user on `probably outdated list` figures in `actual users list` (received from Smartfox) (if not - deleting him)
        var exists = false;
        for(k=0; k<event.params.usersList.length; k++)
        {
          if (jQuery(probablyOutdatedListOfUsers[i]).attr("login")==event.params.usersList[k].login)
          {
            exists = probablyOutdatedListOfUsers[i];
            break;
          }
        }
        if (!exists)
          jQuery(probablyOutdatedListOfUsers[i]).parent().slideUp(function (){ jQuery(this).remove(); });
      }

      // list of user blacklist
      var blacklist = [ ');
      foreach ($_SESSION['blacklist'] as $blocked) echo '"'.$blocked['id'].'", ';
      echo(' ];
      var friends = [ ');
      foreach ($_SESSION['friends'] as $friend) echo '"'.$friend['id'].'", ';
      echo(' ];

      // adding users who exists in `actual users list` (received from Smartfox) and doesn`t exists in `probably outdated list`
      for(i=0; i<event.params.usersList.length; i++)
      {
        if (jQuery(table).find("tr .login[login="+event.params.usersList[i].login+"]").length==0)
        {

          var HTML_sex = "";
          if (event.params.usersList[i].sex=='.SEX_FEMALE.')
            HTML_sex = "<img src=\"'.$directory['design'].'icon_female.png\" alt=\"Kobieta\" title=\"Kobieta\" />";
          else
            HTML_sex = "<img src=\"'.$directory['design'].'icon_male.png\" alt=\"Mężczyzna\" title=\"Mężczyzna\" />";

          var tr = jQuery(\'<tr databaseUserId="\'+event.params.usersList[i].databaseUserId+\'" smartfoxUserId="\'+event.params.usersList[i].smartfoxUserId+\'"><td>\'+HTML_sex+\'</td><td class="login" login="\'+event.params.usersList[i].login+\'">\'+event.params.usersList[i].login+\'</td><td title="Liczba punktów zdobytych przez gracza. Jeśli ujemna, na jego koncie jest więcej partii przegranych niż wygranych.">\'+event.params.usersList[i].scores_sum+\'</td><td title="Miejsce zajmowane aktualnie przez gracza w globalnym rankingu.">#\'+event.params.usersList[i].place+\'</td></tr>\');
          tr.click(function () {
            displayAboutUserWindow(jQuery(this).attr("databaseUserId"));
          });
          if (friends.indexOf(event.params.usersList[i].databaseUserId+"")>=0)
            tr.find("td:first-child").addClass("friend");
          else
            tr.find("td:first-child").removeClass("friend");

          if (blacklist.indexOf(event.params.usersList[i].databaseUserId+"")>=0)
            tr.find("td:first-child").addClass("blocked");
          else
            tr.find("td:first-child").removeClass("blocked");

          table.append(tr);
        }
      }
    }

    function displayAboutUserWindow(databaseUserId)
    {
      var aboutWindow = jQuery(\'<div class="aboutUserWindow"></div>\');
      aboutWindow.load("'.$path['ajaxAboutUserWindow'].'?id_user="+databaseUserId);

      aboutWindow.dialog({
        title: "Karta gracza",
        closeText: "",
        width: "30%",
        minWidth: 250,
        height: 410,
        minHeight: 410
      });
    }

    function displayRoomListLoader(information)
    {
      jQuery(roomListContainer).html("<div class=\"loader animation_rooms\"><img src=\"'.$directory['design'].'loader.gif\" alt=\"Proszę czekać\" /><br />"+information+"</div>");
    }

    function displayUserListLoader(information)
    {
      jQuery(userListContainer).html("<div class=\"loader animation_users\"><img src=\"'.$directory['design'].'loader.gif\" alt=\"Proszę czekać\" /><br />"+information+"</div>");
    }

    function onConnection(evtParams)
    {
      console.log("Połączono z serwerem Smartfox...");
      displayRoomListLoader("Pobieranie listy pokoi...<br />Proszę czekać, trwa logowanie do serwera gier...");
      displayUserListLoader("Pobieranie listy graczy...<br />Proszę czekać, trwa logowanie do serwera gier...");
      smartFox.send(new SFS2X.LoginRequest("'.session_id().'"));
      refreshConnectionStatusLabel();
    }

    function onDisconnect(evtParams)
    {
      refreshConnectionStatusLabel();
      jQuery(roomListContainer).fadeOut(function () { jQuery(this).empty(); });
      jQuery(userListContainer).fadeOut(function () { jQuery(this).empty(); });
    }

    function onLogin(evtParams)
    {
      if (console)
        console.log("Login successful!");
      refreshConnectionStatusLabel();
      jQuery(roomListContainer).fadeIn();

      displayRoomListLoader("Wczytywanie listy pokoi...");
      displayRoomList(true);
      setInterval(displayRoomList, 2000);

      displayUserListLoader("Wczytywanie listy graczy...");
      displayUsersInRoom();
      setInterval(displayUsersInRoom, 3000);
    }

    function onLoginError(evtParams)
    {
      if (console)
        console.log("Login error! "+evtParams.errorMessage);
      refreshConnectionStatusLabel();
    }

    function onExtensionResponse(eventParam)
    {
      switch (eventParam.cmd)
      {
        case "usersList" : onUsersListReceived(eventParam); break;
      }
    }

    function refreshConnectionStatusLabel()
    {
      if (smartFox.isConnected)
        jQuery("#connection_status").removeClass().addClass("connected").text("Połączony");
      else
      {
        var button = jQuery("<button>Rozłączony - kliknij aby połączyć</button>");
        button.click(function () { location.reload(); });
        jQuery("#connection_status").removeClass().addClass("disconnected").empty().append(button);
      }
    }

    function getRoomStatusString(room)
    {
      var usersInRoom = "";
      var list = room.getUserList();
      for (var j=0; j<list.length; j++)
      {
        usersInRoom += list[j].name+", ";
      }
      if (list.length) usersInRoom += " czeka...";
      var spectatorsAndUsersCount = "<span class=\"spectators_and_users\">("+room.spectatorCount+" obserwatorów i "+room.userCount+" graczy)</span>";
      var roomStatus = (room.userCount==2?"<span class=\"busy\">Stół zajęty</span>":"<span class=\"free\">Stół wolny</span>");
      return roomStatus+"<br />"+usersInRoom+" "+spectatorsAndUsersCount;
    }

    function createTableRow(room)
    {
      var tr = jQuery("<tr rel=\""+room.id+"\">");
      jQuery(tr).append("<td class=\"room_name\" rel=\""+room.name+"\">"+room.name+"</td>");
      //jQuery(tr).append("<td class=\"room_id\" rel=\""+room.id+"\">"+room.id+"</td>");
      jQuery(tr).append("<td class=\"room_status\">"+getRoomStatusString(room)+"</td>");

      var button = jQuery("<button>");
      button.attr(\'identyfikatorPokoju\',room.id);
      button.attr(\'roomName\',room.name);
      button.text("Usiądź przy stole");
      button.click(function (){
        location.href = link_dolaczania_do_pokoju+"roomName="+jQuery(this).attr(\'roomName\');;
      });
      var td = jQuery("<td class=\"join_to\">");
      jQuery(td).append(button);
      jQuery(tr).append(td);
      return tr;
    }


    function displayRoomList(createNewTable, onComplete)
    {
      if (!createNewTable) createNewTable = false;

      var roomManager = smartFox.roomManager;
      var roomList = roomManager.getRoomList();

      if (createNewTable)
      {
        var table = jQuery("<table class=\"room_list\">");
        //console.log(JSON.stringify(roomList[1]) );
        var trh = jQuery("<tr>");
        jQuery(trh).append("<th>Nazwa stołu</th>");
        //jQuery(trh).append("<th>Identyfikator</th>");
        jQuery(trh).append("<th>Rozgrywka pomiędzy</th>");
        jQuery(trh).append("<th class=\"join_to\">Dołącz do gry</th>");
        jQuery(table).append(trh);


        for (var i=roomList.length-1; i>=0; i--)
        {
          // Not showing room if it is private
          if (roomList[i].isHidden)
            continue;

          jQuery(table).append(createTableRow(roomList[i]));
        }
        jQuery(roomListContainer).html(table);
      }else{

        // Appending elements which doesn`t exists in table
        for (var i=0; i<roomList.length; i++)
        {
          // Not showing room if it is private
          if (roomList[i].isHidden)
            continue;

          // If there is no room in the table with the given ID, add it to the table and highlight it
          if (jQuery(roomListContainer).find("td.room_name[rel=\""+roomList[i].name+"\"]").length==0)
          {
            var row = jQuery(createTableRow(roomList[i]));
            jQuery(roomListContainer).find("table tr:first").after(row);
            row.effect("highlight",{color:"lime"});
          }
        }

        // Removing elements which doesnt exists in array
        jQuery(roomListContainer).find("td.room_name").each(function (){
          var element_exists = false;
          var element_hidden = false;
          for (var i=0; i<roomList.length; i++)
          {
            if (roomList[i].name==jQuery(this).attr("rel"))
              element_exists = (!roomList[i].isHidden);
          }
          if ((!element_exists)||(element_hidden))
          {
            jQuery(this).parent().effect("highlight", {color:"red"}).find("td").slideUp("slow", function (){
              jQuery(this).remove();
            });
          }
        });

        // Changing elements which changed
        jQuery(roomListContainer).find("td.room_status").each(function (){
          for (var i=0; i<roomList.length; i++)
          {
            if (roomList[i].id==jQuery(this).parent().attr("rel"))
            {
              var roomStatusString = getRoomStatusString(roomList[i]);

              if (jQuery(this).text()!=jQuery("<div>"+roomStatusString+"</div>").text())
              {
                jQuery(this).html(roomStatusString).effect("highlight");

                // Jeśli ilość obserwatorów przekroczy dopuszczalną liczbę to ukryj przycisk dołączania do stołu
                if (roomList[i].spectatorCount>=roomList[i].maxSpectators-1)
                  jQuery(this).parent().find(".join_to button").removeClass().addClass("hidden");
                else
                  jQuery(this).parent().find(".join_to button").removeClass();
              }
            }
          }
        });

      }

      if (onComplete) onComplete();
    }

    function onCreateRoomButtonClick()
    {
      jQuery("#roomCreateOptions").dialog({
        title: "Tworzenie nowego stołu",
        autoOpen: true,
        modal:true,
        closeText: "Zamknij",
        show: {
          effect: "bounce",
          duration: 300
        },
        hide: {
          effect: "drop",
          duration: 400
        },
        buttons: {
          "Stwórz stół" : function () {
            var form = jQuery(this).find("form");
            var room_name = jQuery(form).find("input[name=roomName]").val();         form.attr("action", link_dolaczania_do_pokoju+"roomName="+room_name);
            jQuery(this).find(".invalidData").slideUp();

            if ((room_name==null)||(room_name.trim()=="")||(room_name.length<3)||(room_name.length>15))
            {
              jQuery(this).parent().effect("shake");
              jQuery(this).find(".invalidData").slideDown();
              return false;
            }

            form.submit();
          },
          Anuluj : function () {
            jQuery(this).dialog("close");
          }
        }
      });
    }

    function onGotoCategoriesButtonClick()
    {
      location.href = "'.$path['games'].'?id_category='.intval($_GET['id_category']).'";
    }

    function getActionScriptInterface(movieName)
    {
       if (navigator.appName.indexOf("Microsoft") != -1)
       {
           return window[movieName];
       }
       else
       {
           return document[movieName];
       }
    }

    jQuery(document).ready(function (){
      connect();
      refreshConnectionStatusLabel();
      jQuery("#create_room").unbind().click(onCreateRoomButtonClick);
      jQuery("#goto_category_list").unbind().click(onGotoCategoriesButtonClick);
    });



  </script>

  ');
}

/**
 * Wyświetla listę historycznych rozgrywek danego użytkownika.
 * @param $login
 * @return array
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getPlaysList($login)
{
  global $database_prefix;

  if ($_SESSION['account_type']<USER) throw new ExceptionAccessDenied();

  $login = addslashes(htmlspecialchars($login));
  if ($login == '') $login = $_SESSION['login'];

  $query = 'SELECT '.$database_prefix.'_users.id AS id_user,
                   '.$database_prefix.'_games.zone_name,
                   '.$database_prefix.'_games.title,
                   '.$database_prefix.'_games.id AS id_game,
                   '.$database_prefix.'_games.id_category AS id_game_category,
                   '.$database_prefix.'_users.login,
                   '.$database_prefix.'_scores.date,
                   '.$database_prefix.'_scores.score,
                   '.$database_prefix.'_gameplays.id AS id_gameplay,
                   '.$database_prefix.'_gameplays.date_gameplay_started,
                   '.$database_prefix.'_gameplays.date_gameplay_ended,
                   TIMESTAMPDIFF(SECOND, '.$database_prefix.'_gameplays.date_gameplay_started, '.$database_prefix.'_gameplays.date_gameplay_ended) AS gameplay_duration

              FROM '.$database_prefix.'_gameplays
         LEFT JOIN '.$database_prefix.'_scores
                ON '.$database_prefix.'_gameplays.id = '.$database_prefix.'_scores.id_gameplay
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
         LEFT JOIN '.$database_prefix.'_games
                ON '.$database_prefix.'_games.zone_name = '.$database_prefix.'_gameplays.zone_name

             WHERE login <> "'.$login.'"
               AND '.$database_prefix.'_gameplays.id IN (
                          SELECT id_gameplay
                            FROM '.$database_prefix.'_scores
                       LEFT JOIN '.$database_prefix.'_users
                              ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
                           WHERE login = "'.$login.'"
                           )
          ORDER BY date DESC
             LIMIT 250
          ';
	RunQuery($query, false, $statement);
	
	if (!$statement) {
		throw new ExceptionSQL();
	}
	if (NumQueryRows($statement) == 0) {
		throw new ExceptionNoResults();
	}
	$table = array();
	while ($row = FetchQuery($statement)) {
		$table[] = $row;
	}
	return $table;
}

/**
 * Wyciąga listę ruchów wykonanych w rozgrywce o identyfikatorze podanym jako parametr.
 * @param $id_gameplay
 * @return array
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getGameplayMoves($id_gameplay)
{
  global $database_prefix;

  if ($_SESSION['account_type']<USER) throw new ExceptionAccessDenied();

  $id_gameplay = intval($id_gameplay);

  $query = 'SELECT '.$database_prefix.'_users.id AS id_user,
                   '.$database_prefix.'_users.login,
                   '.$database_prefix.'_moves.id,
                   '.$database_prefix.'_moves.move,
                   '.$database_prefix.'_moves.timestamp
              FROM '.$database_prefix.'_moves
         LEFT JOIN '.$database_prefix.'_users
                ON '.$database_prefix.'_users.id = '.$database_prefix.'_moves.id_user
             WHERE '.$database_prefix.'_moves.id_gameplay = '.$id_gameplay.'
          ORDER BY '.$database_prefix.'_moves.id
          ';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) == 0) throw new ExceptionNoResults();
  $table = array();
	while ($row = FetchQuery($statement))
		$table[] = $row;
  return $table;
}


/**
 * Wyciąga przeciwników gracza o loginie podanym jako parametr.
 * @param $login
 * @return array
 * @throws ExceptionAccessDenied
 * @throws ExceptionNoResults
 * @throws ExceptionSQL
 */
function getUserOpponents($login)
{
  global $database_prefix;

  if ($_SESSION['account_type']<USER) throw new ExceptionAccessDenied();

  $login = addslashes(htmlspecialchars($login));
  if ($login == '') $login = $_SESSION['login'];

  $query = '
    SELECT * FROM ( /* Its enclosed in additional SELECT query because of need of reordering results before groupping */
                      SELECT id_user, id_gameplay, login, date
                        FROM '.$database_prefix.'_scores
                   LEFT JOIN '.$database_prefix.'_users
                          ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
                       WHERE login <> "'.$login.'"
                         AND id_gameplay IN ( /* Wyszukiwanie użytkowników którzy grali z aktualnym użytkownikiem w jakimkolwiek gameplay`u (na gameplay zwykle wchodzi dwóch graczy) (ta sama rozgrywka) */
                                    SELECT id_gameplay
                                      FROM '.$database_prefix.'_scores
                                 LEFT JOIN '.$database_prefix.'_users
                                        ON '.$database_prefix.'_scores.id_user = '.$database_prefix.'_users.id
                                     WHERE login = "'.$login.'"
                                     )
                    ORDER BY date DESC
                  ) AS tab
          GROUP BY id_user
          ';
	$result = RunQuery($query, false, $statement);
	
	if (!$result) {
		throw new ExceptionSQL();
	}
	if (NumQueryRows($statement) == 0) throw new ExceptionNoResults();
  $table = array();
	while ($row = FetchQuery($statement))
		$table[] = $row;
  return $table;
}


/**
 * Wyświetla najnowsze gry.
 * @return int
 */
function GryWyswietlNajnowsze($id_category = 0)
{
	global $database_prefix, $path, $directory;
	
	if ($_SESSION['account_type'] < USER) {
		return BLAD_BRAK_UPRAWNIEN;
	}
	
	$id_category = intval($id_category);
	
	$query = 'SELECT id,
                       id_category,
                       (SELECT title
                          FROM '.$database_prefix.'_games_categories
                         WHERE id = '.$id_category.'
                       ) AS title_kategorii,
                       title,
                       description,
                       directory_name,
                       filename_logo,
                       filename_game,
                       date_add,
                       godzina_dodania
                  FROM '.$database_prefix.'_games
                 WHERE hide = false
              ORDER BY id DESC';
	RunQuery($query, false, $statement);
	
	if (NumQueryRows($statement) > 0) {
		$HTML = '<ul class="gry_pozycje">';
		while ($wiersz = FetchQuery($statement)) {
			$title_kategorii = $wiersz['title_kategorii'];
			$HTML .= '<li>
          <h2><a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">'.$wiersz['title'].'</a></h2>
          <p>
            ';
			if (file_exists($directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'])) {
				$HTML .= '<a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'"><img src="'.$directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'].'" alt="Logo gry" /></a>';
			}
            $HTML .= '
            <strong>Data dodania: '.($wiersz['date_add']==date('Y-m-d')?'dzisiaj':$wiersz['date_add']).' o '.$wiersz['godzina_dodania'].'</strong><br />
            '.nl2br(stripslashes($wiersz['description'])).'
          </p>
          <br style="clear:both" />
        </li>';
      }
      $HTML .= '</ul>';

      echo $HTML;
    }else
    {
      echo('<h2>
      <div class="uwaga">Nie ma jeszcze żadnych gier</div>

      <a href="'.$path['games'].'">&laquo; Przejdź do spisu kategorii gier</a>
      ');
    }
    return OK_WSZYSTKO;
}

/**
 * Wyświetla najpopularniejsze gry.
 * @param int $ilosc Maksymalna ilość gier do wyświetlenia.
 * @return int
 */
function GryWyswietlNajpopularniejsze($ilosc = 0, $id_category = 0)
{
	global $database_prefix, $database_handle, $path, $directory, $player_active_state_time_period;

//  if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }
	
	$id_category = intval($id_category);
	$ilosc = intval($ilosc);
	if ($ilosc > 0) {
		$SQL_ilosc = ' LIMIT '.$ilosc;
	} else {
		$SQL_ilosc = '';
  }


  $query = 'SELECT id,
                   id AS parent_query_id_game,
                   id_category,
                   (SELECT title
                      FROM '.$database_prefix.'_games_categories
                     WHERE id = '.$id_category.'
                   ) AS title_kategorii,
                   title,
                   description,
                   directory_name,
                   (
                        SELECT COUNT(*)
                          FROM '.$database_prefix.'_gameplays
                     LEFT JOIN '.$database_prefix.'_games
                            ON '.$database_prefix.'_gameplays.zone_name = '.$database_prefix.'_games.zone_name
                         WHERE '.$database_prefix.'_games.id = parent_query_id_game
                   ) AS counter_plays,
                   filename_logo,
                   filename_game,
                   date_add,
                   (
                      SELECT COUNT(*)
                      FROM
                        (
                             SELECT zone_name
                               FROM '.$database_prefix.'_moves
                          LEFT JOIN '.$database_prefix.'_gameplays
                                 ON '.$database_prefix.'_gameplays.id = '.$database_prefix.'_moves.id_gameplay
                              WHERE
                                    TIMESTAMPDIFF(MINUTE, '.$database_prefix.'_moves.timestamp, CURRENT_TIMESTAMP()) < '.$player_active_state_time_period.'
                           GROUP BY id_user
                        ) AS last_moves_groupped_by_user
                      WHERE
                        last_moves_groupped_by_user.zone_name = '.$database_prefix.'_games.zone_name
                   ) AS number_of_players
              FROM '.$database_prefix.'_games
             ORDER BY counter_plays DESC
               '.$SQL_ilosc;
	
	$statement = $database_handle->prepare($query);
	$statement->execute();
	$rows = $statement->fetchAll();
	if (count($rows) > 0) {
		$HTML = '<ul class="gry_pozycje">';
		foreach ($rows as $wiersz) {
			$title_kategorii = $wiersz['title_kategorii'];
			$HTML .= '<li class="box light">
          <div class="corner top left"></div>
          <div class="corner bottom left"></div>
          <div class="corner top right"></div>
          <div class="corner bottom right"></div>
          <div class="border top"></div>
          <div class="border bottom"></div>
          <div class="border left"></div>
          <div class="border right"></div>
          <div class="content">
            <h2><a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">'.$wiersz['title'].'</a><span class="game_online">online</span></h2>
            <div class="game_links">
              <a href="'.$path['games'].'">zobacz wszystkie gry</a><br />
              <a href="'.$path['help'].'?id_game='.$wiersz['id'].'">zasady gry w <span class="game_name_highlight">'.$wiersz['title'].'</span></a><br />
            </div>
            ';
            if (file_exists($directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo']))
            {
              $HTML .= '<div class="box dark">
                <div class="corner top left"></div>
                <div class="corner bottom left"></div>
                <div class="corner top right"></div>
                <div class="corner bottom right"></div>
                <div class="border top"></div>
                <div class="border bottom"></div>
                <div class="border left"></div>
                <div class="border right"></div>
                <div class="content">
                  <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'">
                  <img src="'.$directory['games'].$wiersz['directory_name'].'/'.$wiersz['filename_logo'].'" alt="Logo gry" /></a>
                </div>
              </div>';
            }
            // description gry: nl2br(stripslashes($wiersz['description']))
            $HTML .= '
            <div class="option">
              <div class="numberOfPlayersLabel">graczy online</div>
              <img src="'.$directory['design'].'users.png" alt="" /><div class="numberOfPlayers">'.($wiersz['number_of_players']).'</div>
            </div>
            <div class="option tournament"><a href="'.$path['tournaments'].'?id_game='.$wiersz['id'].'">Turnieje</a></div>
            <div class="option username"><a href="'.$path['profile'].'">'.(($_SESSION['account_type']>=USER)?$_SESSION['login']:'Gość').'</a></div>
            <a href="'.$path['games'].'?id_category='.$wiersz['id_category'].'&amp;id_game='.$wiersz['id'].'" class="button_normal play">Zagraj</a>
          </div>
        </li>';
      }
      $HTML .= '</ul>';

      echo $HTML;
    }else
    {
      echo('
      <div class="uwaga">Nie ma jeszcze żadnych gier.</div>

      <a href="'.$path['games'].'">&laquo; Przejdź do spisu kategorii gier</a>
      ');
    }
    return OK_WSZYSTKO;

}


/**
 * Zwraca statystyki dotyczące gry o identyfikatorze podanym jako parametr.
 * @param $id_game
 * @return array|int
 */
function GryZwrocStatystyki($id_game)
{
  global $database_prefix, $player_active_state_time_period;

//  if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }

  $id_game = intval($id_game);

  $query = 'SELECT
                       (
                            SELECT COUNT(*)
                              FROM '.$database_prefix.'_gameplays
                         LEFT JOIN '.$database_prefix.'_games
                                ON '.$database_prefix.'_gameplays.zone_name = '.$database_prefix.'_games.zone_name
                             WHERE '.$database_prefix.'_games.id = '.$id_game.'
                       ) AS counter_plays,

                      (SELECT COUNT(id_user) FROM
                         (SELECT id_user
                            FROM '.$database_prefix.'_gameplays
                       LEFT JOIN '.$database_prefix.'_games
                              ON '.$database_prefix.'_gameplays.zone_name = '.$database_prefix.'_games.zone_name
                       LEFT JOIN '.$database_prefix.'_scores
                              ON '.$database_prefix.'_gameplays.id = '.$database_prefix.'_scores.id_gameplay
                           WHERE '.$database_prefix.'_games.id = '.$id_game.'
                        GROUP BY id_user) AS tabela1
                       ) AS unique_players_count,

                       (SELECT COUNT(id_user) FROM
                         (SELECT id_user
                            FROM '.$database_prefix.'_gameplays
                       LEFT JOIN '.$database_prefix.'_games
                              ON '.$database_prefix.'_gameplays.zone_name = '.$database_prefix.'_games.zone_name
                       LEFT JOIN '.$database_prefix.'_moves
                              ON '.$database_prefix.'_gameplays.id = '.$database_prefix.'_moves.id_gameplay
                           WHERE TIMESTAMPDIFF(SECOND, timestamp, CURRENT_TIMESTAMP()) <= ('.$player_active_state_time_period.'*60)
                             AND '.$database_prefix.'_games.id = '.$id_game.'
                           GROUP BY id_user) AS tabela2
                       ) AS active_players_count
               ';
	$wiersz = RunQuery($query);
	
	return $wiersz;
}


/**
 * // TODO: Function is not used and may be outdated in relation of database structure
 * Wyświetla profile użytkowników którzy również grają w grę o identyfikatorze podanym jako parametr, w pokoju podanym jako parametr.
 * @param $id_game
 * @param $roomName
 * @return int
 */
function GryObecnieGraja($id_game, $roomName)
{
  global $database_prefix, $path, $player_active_state_time_period, $directory;

  if ($_SESSION['account_type']<USER) { return BLAD_BRAK_UPRAWNIEN; }

  $id_game = intval($id_game);
  $roomName = addslashes(htmlspecialchars($roomName));

  $query = 'SELECT id_account AS identyfikator,
                       zdjecie,
                       name,
                       surname,
                       sex,
                       miejscowosc_zamieszkania,
                       status,
                       data_urodzenia,
                       date_play,
                       date_register,

                       /* Pobieranie czasu rozgrywki */
                       (SELECT TIMESTAMPDIFF(SECOND, CONCAT(date_play," ",godzina_rozgrywki), CONCAT(CURRENT_DATE()," ",CURRENT_TIME()))
                          FROM '.$database_prefix.'_gameplays
                         WHERE id_account=identyfikator
                      ORDER BY date_play DESC, godzina_rozgrywki DESC
                         LIMIT 1) AS czas_rozgrywki,

                      (SELECT counter_plays
                         FROM '.$database_prefix.'_games
                        WHERE id = '.$id_game.'
                       ) AS counter_plays,

                      (SELECT COUNT(id_account) FROM
                         (SELECT id_account
                            FROM '.$database_prefix.'_gameplays
                        GROUP BY id_account) AS tabela1
                       ) AS unique_players_count,

                       (SELECT COUNT(id_account) FROM
                         (SELECT id_account
                            FROM '.$database_prefix.'_gameplays
                           WHERE TIMESTAMPDIFF(SECOND, CONCAT(date_play," ",godzina_rozgrywki), CONCAT(CURRENT_DATE()," ",CURRENT_TIME())) <= ('.$player_active_state_time_period.'*60)
                           GROUP BY id_account) AS tabela2
                       ) AS active_players_count,

                       /* Pobieranie ilości znajomych użytkownika */
                       (
                        (SELECT COUNT(id_uzytkownika2) AS znajomi_ilosc
                          FROM '.$database_prefix.'_powiazania_ze_znajomymi
                         WHERE
                              (
                                (uzytkownik1_akceptacja=1)
                                AND
                                (uzytkownik2_akceptacja=1)
                              )
                              AND
                              (
                                (id_uzytkownika1=identyfikator)
                              )
                        )
                        +
                        (
                        SELECT COUNT(id_uzytkownika1) AS znajomi_ilosc
                          FROM '.$database_prefix.'_powiazania_ze_znajomymi
                         WHERE
                              (
                                (uzytkownik1_akceptacja=1)
                                AND
                                (uzytkownik2_akceptacja=1)
                              )
                              AND
                              (
                                (id_uzytkownika2=identyfikator)
                              )
                        )
                       ) AS znajomi_ilosc,
                       /* Koniec pobierania ilości znajomych użytkownika */

                       /* Pobieranie ilości zdjęć umieszczonych w galerii prywatnej */
                       (SELECT COUNT(*) FROM '.$database_prefix.'_zdjecia_users WHERE id_wlasciciela=identyfikator) AS galeria_prywatna_ilosc_zdjec,
                       /* Koniec pobierania ilości zdjęć umieszczonych w galerii prywatnej */

                       /* Pobieranie ilości komentarzy profilu */
                       (SELECT COUNT(*) FROM '.$database_prefix.'_komentarze_kont WHERE '.$database_prefix.'_komentarze_kont.id_uzytkownika=identyfikator) AS profil_ilosc_komentarzy,
                       /* Koniec pobierania ilości komentarzy profilu */

                       /* Pobieranie ilości wpisów na mikroblogu */
                       (SELECT COUNT(*) FROM '.$database_prefix.'_mikroblog WHERE '.$database_prefix.'_mikroblog.id_autora=identyfikator) AS mikroblog_ilosc_wpisow,
                       /* Koniec pobierania ilości wpisów na mikroblogu */

                       /* Pobieranie ilości linków użytkownika */
                       (SELECT COUNT(*) FROM '.$database_prefix.'_linki_users WHERE '.$database_prefix.'_linki_users.id_uzytkownika=identyfikator) AS linki_ilosc
                       /* Koniec pobierania ilości linków użytkownika */


                  FROM '.$database_prefix.'_gameplays
             LEFT JOIN '.$database_prefix.'_users
                    ON '.$database_prefix.'_users.id = '.$database_prefix.'_gameplays.id_account
                 WHERE TIMESTAMPDIFF(SECOND, CONCAT(date_play," ",godzina_rozgrywki), CONCAT(CURRENT_DATE()," ",CURRENT_TIME())) <= ('.$player_active_state_time_period.'*60)
              GROUP BY id_account
              ORDER BY '.$database_prefix.'_gameplays.id DESC
               ';
	RunQuery($query, false, $statement);

    $pierwsza_iteracja = true;
	while ($wiersz = FetchQuery($statement)) {
		if ($pierwsza_iteracja) {
			echo('<h2>Obecnie w tę grę grają ('.$wiersz['active_players_count'].')</h2>');
			
			echo('<div class="malo_wazne">Teraz grających: '.$wiersz['active_players_count'].' | ');
			echo('Ilość unikalnych graczy: '.$wiersz['unique_players_count'].' | ');
			echo('Ilość wszystkich rozgrywek: '.$wiersz['counter_plays'].'</div>');
			
			$pierwsza_iteracja = false;
		}
		if (NumQueryRows($statement) > 0) {
			echo('<ul>');
      }
      WyswietlMiniaturkeProfilu(
        WyswietlMiniaturkeProfiluTworzTablicePomocnik(
          $wiersz['identyfikator'],
          $wiersz['zdjecie'],
          $wiersz['name'],
          $wiersz['surname'],
          $wiersz['sex'],
          $wiersz['miejscowosc_zamieszkania'],
          $wiersz['status'],
          (time()-strtotime($wiersz['data_urodzenia']))/60/60/24/365,
          $wiersz['date_register'],
          $wiersz['znajomi_ilosc'],
          $wiersz['galeria_prywatna_ilosc_zdjec'],
          $wiersz['profil_ilosc_komentarzy'],
          $wiersz['mikroblog_ilosc_wpisow'],
          $wiersz['linki_ilosc']
        )
      );
		if (NumQueryRows($statement) > 0) {
			echo('</ul>');
      }
    }
    return OK_WSZYSTKO;
}
