package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class AnswerTieHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		
		if (gameExt.isGameStarted())
		{
			
			if(params.getBool("answer") == true) {	
				
				gameExt.trace("TIE!");
				
				// Stop game
				gameExt.stopGame();
				
				// Send update
				ISFSObject respObj = new SFSObject();
				gameExt.send("tie", respObj, gameExt.getGameRoom().getUserList());
				
				// Set the last game ending for spectators joining after the end and before a new game starts
				gameExt.setLastGameEndResponse(new LastGameEndResponse("tie", respObj));
				
			}else{
				// send info
				//gameExt.setTie( user.getPlayerId() );
				
				ISFSObject respObj = new SFSObject();
				respObj.putUtfString("player", user.getName());
				respObj.putBool("answer", false);
				
				send("answerTie", respObj, gameExt.getGameRoom().getUserList());
				
				gameExt.startTimer();
			}
		}
	}

}
