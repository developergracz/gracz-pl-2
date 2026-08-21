package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class ReadyHandler extends BaseClientRequestHandler
{
	@Override
	public void handleClientRequest(User user, ISFSObject params)
	{
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		gameExt.trace("Ready: "+gameExt.isReady(1)+" "+gameExt.isReady(2));
		if (user.isPlayer())
		{
				gameExt.setReady(user.getPlayerId());
				// Checks if two players are available and start game
				gameExt.trace(String.format("Player 1 ready: %s, Player 2 ready: %s", gameExt.isReady(1), gameExt.isReady(2)));
				if (gameExt.getGameRoom().getSize().getUserCount() == 2 && gameExt.isReady(1) && gameExt.isReady(2))
					gameExt.startGame();
		}
		
		else
		{
			gameExt.updateSpectator(user);
			
			LastGameEndResponse endResponse = gameExt.getLastGameEndResponse();
			
			// If game has ended send the outcome
			if (endResponse != null)
				send(endResponse.getCmd(), endResponse.getParams(), user);
		}
	}
}
