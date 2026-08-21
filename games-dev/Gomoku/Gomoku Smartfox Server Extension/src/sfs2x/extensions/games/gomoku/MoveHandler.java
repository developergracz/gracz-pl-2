package sfs2x.extensions.games.gomoku;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import com.smartfoxserver.v2.annotations.Instantiation;
import com.smartfoxserver.v2.annotations.Instantiation.InstantiationMode;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.exceptions.SFSRuntimeException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;
import com.smartfoxserver.v2.extensions.ExtensionLogLevel;
import com.smartfoxserver.v2.db.*;

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
		if (!params.containsKey("x") || !params.containsKey("y"))
			throw new SFSRuntimeException("Invalid request, one mandatory param is missing. Required 'x' and 'y'");
		
		GomokuExtension gameExt = (GomokuExtension) getParentExtension();
		GomokuGameBoard board = gameExt.getGameBoard();
		
		int moveX = params.getInt("x");
		int	moveY = params.getInt("y");
		
		gameExt.trace(String.format("Handling move from player %s. (%s, %s) = %s ", user.getPlayerId(), moveX, moveY, board.getTileAt(moveX, moveY)));
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
			stmt.setString(3, "("+moveX+","+moveY+") = "+board.getTileAt(moveX, moveY));
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

		
		gameExt.getGameBoard().setLastMove(moveX, moveY);
		if (gameExt.isGameStarted())
		{
			if (gameExt.getWhoseTurn() == user)
			{
				if (board.getTileAt(moveX, moveY) == Tile.EMPTY)
				{
					// Set game board tile
					board.setTileAt(moveX, moveY, user.getPlayerId() == 1 ? Tile.BLACK : Tile.WHITE);
					
					// Send response
					ISFSObject respObj = new SFSObject();
					respObj.putInt("x", moveX);
					respObj.putInt("y", moveY);
					respObj.putInt("t", user.getPlayerId());
					
					send(CMD_MOVE, respObj, gameExt.getGameRoom().getUserList());
					
					// Increse move count and check game status					
					gameExt.increaseMoveCount();
					
					// Switch turn
					gameExt.updateTurn();
					
					// Check if game is over
					checkBoardState(gameExt);
				}
			}
			
			// Wrong turn
			else
				gameExt.trace(ExtensionLogLevel.WARN, "Wrong turn error. It was expcted: " + gameExt.getWhoseTurn() + ", received from: " + user);
		}
		else
			gameExt.trace(ExtensionLogLevel.WARN, "Wrong turn error. It was expcted: " + gameExt.getWhoseTurn() + ", received from: " + user);
		
	}
	
	private void checkBoardState(GomokuExtension gameExt)
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
			
			// Send update
			ISFSObject respObj = new SFSObject();
			gameExt.send(CMD_TIE, respObj, gameExt.getGameRoom().getUserList());
			
			// Zmiana wprowadzona przez £ukasz Wyporek, 11.06
			// Add points to user account in SQL database
			gameExt.addScoreToPlayersAccounts(0,1);

			// Set the last game ending for spectators joining after the end and before a new game starts
			gameExt.setLastGameEndResponse(new LastGameEndResponse(CMD_TIE, respObj));
		}
	}
}
