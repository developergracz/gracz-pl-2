package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

// Added 16.03.2015 by £ukasz Wyporek
public class SetGameAsNotInRankHandler extends BaseClientRequestHandler  {
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		Boolean noRanking = params.getBool("noRanking").booleanValue();
		
		Room room = this.getParentExtension().getParentRoom();
		IGeneralRoomOptions gameExt = (IGeneralRoomOptions) room.getExtension();			
		
		// Only if user is room creator
		if (gameExt.isUserRoomCreator(user))
		{
			if (!gameExt.isGameStarted())
			{
				if (gameExt.setNoRankingOption(user, noRanking))
				{
					trace(user.getName()+" set `Game with no ranking` option to: "+noRanking);
				}else{
					trace("Warning: "+user.getName()+" can't set `Game with no ranking` option to: "+noRanking+". User can't change this option during gameplay.");
				}
				// sending notification to all users in this room
				ISFSObject sfsObject = new SFSObject();
				sfsObject.putBool("gameNotInRank", gameExt.getNoRankingOption());
				java.util.List<User> usersList = room.getUserList();
				usersList.remove(user); // remove user which demand variable change
				send("setGameAsNotInRank",sfsObject,usersList);
			}else{
				trace("Can't turn on/off `game with no ranking` option while game is running.");
			}
		}else{
			this.getParentExtension().trace("User isn't creator of this room, so he can't turn on/off `game with no ranking` option. Sending back actual setting.");			
			ISFSObject sfsObject = new SFSObject();
			sfsObject.putBool("gameNotInRank", gameExt.getNoRankingOption());
			send("setGameAsNotInRank",sfsObject,user);
		}
		
	}

}
