package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class AnswerUndoHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		GameBoard board = gameExt.getGameBoard();
		if (gameExt.isGameStarted())
		{
			gameExt.trace("Undo: "+params.getBool("answer"));
			if(params.getBool("answer") == true) {	
				if(board.moveLength() > 0) {
					ISFSObject respObj = new SFSObject();
					respObj.putUtfString("player", user.getName());
					respObj.putBool("answer", true);
					
					// change board
					// 
					// == user 1 cofniecie, != 2
					/*if (gameExt.getWhoseTurn() != user) {
						gameExt.trace("Cofniecie 2 ruchow");
						respObj.putInt("x2", board.getLastMove()[0]);
						respObj.putInt("y2", board.getLastMove()[1]);
						//board.setTileAt( board.getLastMove()[0], board.getLastMove()[1], Tile.EMPTY);
						
					}*/
					gameExt.trace("Cofniecie 1 ruchu");
					respObj.putInt("x1", board.getLastMove()[0]);
					respObj.putInt("y1", board.getLastMove()[1]);
					respObj.putInt("p1", board.getLastMove()[2]);
					respObj.putInt("x2", board.getLastMove()[3]);
					respObj.putInt("y2", board.getLastMove()[4]);
					respObj.putInt("p2", board.getLastMove()[5]);
					
					if(board.getLastMove().length > 6) {
						respObj.putInt("rx", board.getLastMove()[6]);
						respObj.putInt("ry", board.getLastMove()[7]);
						respObj.putInt("rp", board.getLastMove()[8]);
					}
					//board.setTileAt(board.getLastMove()[0], board.getLastMove()[1], Tile.EMPTY);
					
					board.removeLastMove();
					
					
					
					if (gameExt.getWhoseTurn() == user) {
						gameExt.updateTurn();
						respObj.putBool("changeTurn", true);
						gameExt.trace("Zmiana tury");
					/*}else if( board.getLastMove()[2] == lastPiece || board.getLastMove()[2] == lastPiece+4 || board.getLastMove()[2] == lastPiece-4) {
						respObj.putBool("changeTurn", false);*/
					}else{
						respObj.putBool("changeTurn", false);
						gameExt.trace("Bez zmiany tury");
					}
					
					send("answerUndo", respObj, gameExt.getGameRoom().getUserList());
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
