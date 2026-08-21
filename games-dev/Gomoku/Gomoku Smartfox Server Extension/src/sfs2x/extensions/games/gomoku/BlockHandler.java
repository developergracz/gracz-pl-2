package sfs2x.extensions.games.gomoku;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class BlockHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		GomokuExtension gameExt = (GomokuExtension) getParentExtension();
		
		if (gameExt.isGameStarted())
		{
				
				ISFSObject respObj = new SFSObject();
				respObj.putUtfString("player", user.getName());
				respObj.putUtfString("block", params.getUtfString("block"));
				
				send("blocked", respObj, gameExt.getGameRoom().getUserList());
				
				gameExt.stopGame();
		}
		
	}

}
