package sfs2x.extensions.games.gomoku;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class SitHandler extends BaseClientRequestHandler
{
	@Override
	public void handleClientRequest(User user, ISFSObject params)
	{
		GomokuExtension gameExt = (GomokuExtension) getParentExtension();
		
		
		if (params.containsKey("place"))
		{
			//gameExt.trace(String.format("Sitted player: %s place: %s", user.getName(), params.getInt("place")));
			int place = params.getInt("place");
			
			gameExt.trace("isSitted: "+place+" "+gameExt.isSitted(place)+" isPlayer: "+user.isPlayer());
			
			if(!gameExt.isSitted(place) && user.isPlayer()) {
				gameExt.sittDown(place, user.getPlayerId());

					// Send response
					ISFSObject respObj = new SFSObject();
					respObj.putInt("place", place);
					respObj.putUtfString("name", user.getName());
					//respObj.putInt("id", user.getPlayerId());
					
					gameExt.send("sit", respObj, gameExt.getGameRoom().getUserList());
					//gameExt.trace(String.format("Sitted"));
					gameExt.trace("Player Id: "+user.getPlayerId()+ " sitted down at: "+place);
			}else{
				gameExt.trace("Sitted id: "+gameExt.getSittedId(place)+" Name: "+gameExt.getSittedName(place));
			}
			
			
		}		
	}
}
