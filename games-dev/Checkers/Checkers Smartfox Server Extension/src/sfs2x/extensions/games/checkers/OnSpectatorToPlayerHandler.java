package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.core.ISFSEvent;
import com.smartfoxserver.v2.core.SFSEventParam;
import com.smartfoxserver.v2.exceptions.SFSException;
import com.smartfoxserver.v2.extensions.BaseServerEventHandler;

public class OnSpectatorToPlayerHandler extends BaseServerEventHandler
{
	@Override
	public void handleServerEvent(ISFSEvent event) throws SFSException
	{
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		trace("Spectator was switched to player: " +  event.getParameter(SFSEventParam.USER)); // added by £ukasz Wyporek, 16.06
		trace("ROOM: " + event.getParameter(SFSEventParam.ROOM) ); // added by £ukasz Wyporek, 16.06
		//System.out.println("Player was switched: " +  event.getParameter(SFSEventParam.USER));
		//System.out.println("Room: " + gameExt.getGameRoom() + " => " + gameExt.getGameRoom().getSize());
		
		// Checks if two players are available and start game
		if (gameExt.getGameRoom().getSize().getUserCount() == 2 && gameExt.isReady(1) && gameExt.isReady(2))
			gameExt.startGame();
	}
}
