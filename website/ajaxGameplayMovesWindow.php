<?php include("variables_local.php"); include_once($actual_path."wykonanie_procedur_startowych.php"); ?>

      <?php

      if ($_SESSION['account_type']>=USER)
      {
        try{
          $moves = getGameplayMoves($_REQUEST['id_gameplay']);
          
          echo('<h1>Rozgrywka #'.intval($_REQUEST['id_gameplay']).'</h1>');
          
          echo('<table>
          <thead>
            <tr><th>#</th><th>Ruch wykonał</th><th>Ruch</th><th>Znacznik czasu</th></tr>
          </thead>
          <tbody>
          ');
          foreach($moves as $move)
          {
            echo('<tr>
            <td>'.$move['id'].'</td><td><a href="'.$path['profile'].'-'.$move['login'].'" target="_blank">'.$move['login'].'</a></td><td>'.$move['move'].'</td><td>'.$move['timestamp'].'</td>
            </tr>');
          }
          echo('
          </tbody>
          </table>');
          
        }catch(ExceptionNoResults $e) 
        {
          echo('Podana rozgrywka nie istnieje.');
        }catch(Exception $e)
        {
          echo($e);
        }
        
      }
      
  ?>
  
    
<?php include_once($actual_path."wykonanie_procedur_koncowych.php"); ?>