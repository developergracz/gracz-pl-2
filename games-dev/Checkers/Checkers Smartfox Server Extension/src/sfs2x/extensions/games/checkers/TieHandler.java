package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class TieHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		
		if (gameExt.isGameStarted())
		{
			if(gameExt.canITie( user.getPlayerId() )) {
				
				gameExt.setTie( user.getPlayerId() );
				
				ISFSObject respObj = new SFSObject();
				respObj.putUtfString("player", user.getName());
				
				send("ask4tie", respObj, gameExt.getGameRoom().getUserList());
				
				gameExt.stopTimer();
			}
		}
		
	}

}
