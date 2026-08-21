package sfs2x.extensions.games.gomoku;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class AnswerUndoHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		GomokuExtension gameExt = (GomokuExtension) getParentExtension();
		GomokuGameBoard board = gameExt.getGameBoard();
		
		if (gameExt.isGameStarted())
		{
			System.out.println("Undo: "+params.getBool("answer"));
			if(params.getBool("answer") == true) {	
				if(board.moveLength() > 0) {
					ISFSObject respObj = new SFSObject();
					respObj.putUtfString("player", user.getName());
					respObj.putBool("answer", true);
					
					// change board
					// 
					// == user 1 cofniecie, != 2
					if (gameExt.getWhoseTurn() != user) {
						System.out.println("Cofniecie 2 ruchow");
						respObj.putInt("x2", board.getLastMove()[0]);
						respObj.putInt("y2", board.getLastMove()[1]);
						board.setTileAt( board.getLastMove()[0], board.getLastMove()[1], Tile.EMPTY);
						
					}
					System.out.println("Cofniecie 1 ruchu");
					respObj.putInt("x1", board.getLastMove()[0]);
					respObj.putInt("y1", board.getLastMove()[1]);
					board.setTileAt(board.getLastMove()[0], board.getLastMove()[1], Tile.EMPTY);
					
					
					send("answerUndo", respObj, gameExt.getGameRoom().getUserList());
					
					if (gameExt.getWhoseTurn() == user) {
						gameExt.updateTurn();
					}
				}
				gameExt.startTimer();

				
			}else{
				// send info
				//gameExt.setTie( user.getPlayerId() );
				
				ISFSObject respObj = new SFSObject();
				respObj.putUtfString("player", user.getName());
				respObj.putBool("answer", false);
				
				send("answerUndo", respObj, gameExt.getGameRoom().getUserList());
				
				gameExt.startTimer();
			}
		}
	}

}
