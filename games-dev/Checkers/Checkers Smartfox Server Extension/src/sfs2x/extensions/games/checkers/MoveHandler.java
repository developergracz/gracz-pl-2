package sfs2x.extensions.games.checkers;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import com.smartfoxserver.v2.annotations.Instantiation;
import com.smartfoxserver.v2.annotations.Instantiation.InstantiationMode;
import com.smartfoxserver.v2.db.IDBManager;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.exceptions.SFSRuntimeException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

@Instantiation(InstantiationMode.SINGLE_INSTANCE)
public class MoveHandler extends BaseClientRequestHandler
{
	private static final String CMD_WIN = "win";
	private static final String CMD_TIE = "tie";
	private static final String CMD_MOVE = "move";
	
	@Override
	public void handleClientRequest(User user, ISFSObject params)
	{
		// Check params
		// x1, y1 : x2, y2
		//if (!params.containsKey("x1") || !params.containsKey("y1") || !params.containsKey("x2") || !params.containsKey("y2"))
		//	throw new SFSRuntimeException("Invalid request, one mandatory param is missing. Required 'x' and 'y'");
		
		if (!params.containsKey("moves"))
			throw new SFSRuntimeException("Invalid request, one mandatory param is missing. Required 'moves'");
		
		
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		GameBoard board = gameExt.getGameBoard();
		
		if (gameExt.isGameStarted() && gameExt.getWhoseTurn() == user) {
			
			int removeX = 0;//params.getInt("x1");
			int	removeY = 0;//params.getInt("y1");
			
			int moveX = 0;//params.getInt("x2");
			int	moveY = 0;//params.getInt("y2");
			
			int piece1 = 0;	int piece2 = 0;
			
			
			ISFSObject moves = params.getSFSObject("moves");
			ISFSObject temp = null;
			for(int i = 0; i<moves.size(); i++){
			
				temp = moves.getSFSObject(i+"");
				removeX = temp.getInt("x1");
				removeY = temp.getInt("y1");
				piece1 = temp.getInt("p1");
				
				moveX = temp.getInt("x2");
				moveY = temp.getInt("y2");	
				piece2 = temp.getInt("p2");
				
				if(temp.containsKey("rx")) {
					board.removeTileAt(temp.getInt("rx"), temp.getInt("ry"));
				}
				
				gameExt.trace(String.format("Handling move from player %s. %s:%s(%s)->%s:%s(%s) ", user.getPlayerId(), removeX, removeY, piece1, moveX, moveY, piece2));
				// Added by £ukasz Wyporek, 14.10.2014
				IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
				Connection connection = null;
				try
				{
					// Grab a connection from the DBManager connection pool
					connection = dbManager.getConnection();
					if (connection==null)
						trace("Error: A database connection retreived from DBManager is null.");
					
					// Build a prepared statement
					// id_user and internal playerId are different IDs (we can't change internal smartfox's playerId to our user_id)
					PreparedStatement stmt = connection.prepareStatement("INSERT LOW_PRIORITY INTO prefix_moves(id_gameplay, id_user, move) VALUES (?, ?, ?)");
					stmt.setLong(1, gameExt.getGameplayId());
					stmt.setLong(2, (Integer) gameExt.getGameRoom().getUserByPlayerId(user.getPlayerId()).getSession().getProperty("php_user_id") );
					stmt.setString(3, removeX+":"+removeY+"("+piece1+")->"+moveX+":"+moveY+"("+piece2+")");
					// Execute query
					stmt.execute();
					trace("A users move record has been added to the database.");
				}catch(SQLException sqle)
				{
			        trace("Database SQL statement error when trying to add move record to the database. "+sqle.toString());
				}finally
				{
				    try
				    {
				    	connection.close();
				    	trace("Database connection closed (OK).");
				    }
				    catch(SQLException sqle)
				    {
				        trace("Database connection (from extension) can not be NULL (but it is!).");
				    }
				}
				// End: Added by £ukasz Wyporek, 14.10.2014
				
				//if (board.getTileAt(moveX, moveY) == Tile.ENABLE ) {
					Tile pre_tile = Tile.getTileById(piece1);
					Tile tile = Tile.getTileById(piece2);
					/*switch(piece) {
						case 0:
							tile = Tile.EMPTY; break;
						case 2:
							tile = Tile.RED; break;	
						case 4:
							tile = Tile.WHITE; break;
						case 6:
							tile = Tile.RED_QUEEN; break;	
						case 8:
							tile = Tile.WHITE_QUEEN; break;
					}*/
					//gameExt.getGameBoard().setLastMove(removeX, removeY, moveX, moveY, tile);
					//board.setTileAt(removeX, removeY, moveX, moveY, tile);
					if(temp.containsKey("rx")) {
						board.setTileAt(removeX, removeY, pre_tile, moveX, moveY, tile, temp.getInt("rx"), temp.getInt("ry"), Tile.getTileById(temp.getInt("rp")));
					}else{
						board.setTileAt(removeX, removeY, pre_tile, moveX, moveY, tile);
					}
					//board.setTileAt(removeX, removeY, Tile.ENABLE);
				//}
			}
			
			// send response
			ISFSObject respObj = new SFSObject();
			/*respObj.putInt("x1", removeX);
			respObj.putInt("y1", removeY);
			respObj.putInt("x2", moveX);
			respObj.putInt("y2", moveY);*/
			respObj.putSFSObject("moves", moves);
			respObj.putInt("t", user.getPlayerId());
			
			send(CMD_MOVE, respObj, gameExt.getGameRoom().getUserList());
			
			// Increse move count and check game status					
			gameExt.increaseMoveCount();
			
			if(temp.getBool("changeTurn")) {
				// Switch turn
				gameExt.updateTurn();
			}
			
			// Check if game is over
			checkBoardState(gameExt);
			
		}
	}
	
	private void checkBoardState(CheckersExtension gameExt)
	{
		GameState state = gameExt.getGameBoard().getGameStatus(gameExt.getMoveCount());
		
		if (state == GameState.END_WITH_WINNER)
		{
			int winnerId = gameExt.getGameBoard().getWinner();
			
			gameExt.trace("Winner found: ", winnerId);
			
			// Stop game
			gameExt.stopGame();
			
			// Send update
			ISFSObject respObj = new SFSObject(); 
			respObj.putInt("w", winnerId);
			respObj.putUtfString("s", gameExt.getGameRoom().getUserByPlayerId(winnerId).getName());
			gameExt.send(CMD_WIN, respObj, gameExt.getGameRoom().getUserList());
			
			// Zmiana wprowadzona przez £ukasz Wyporek, 11.06
			// Add points to user account in SQL database
			gameExt.addScoreToPlayersAccounts(1, winnerId);

			//trace(gameExt.getGameRoom().getUserByPlayerId(winnerId).getName());
			// Set the last game ending for spectators joining after the end and before a new game starts
			gameExt.setLastGameEndResponse(new LastGameEndResponse(CMD_WIN, respObj));
			
			// Next turn will be given to the winning user.
			gameExt.setTurn(gameExt.getGameRoom().getUserByPlayerId(winnerId));
		}
		
		else if (state == GameState.END_WITH_TIE)
		{
			gameExt.trace("TIE!");
			
			// Stop game
			gameExt.stopGame();

			// Add points to user account in SQL database
			gameExt.addScoreToPlayersAccounts(0, 1);
			
			// Send update
			ISFSObject respObj = new SFSObject();
			gameExt.send(CMD_TIE, respObj, gameExt.getGameRoom().getUserList());
			
			// Set the last game ending for spectators joining after the end and before a new game starts
			gameExt.setLastGameEndResponse(new LastGameEndResponse(CMD_TIE, respObj));
		}
	}
	
	
}
