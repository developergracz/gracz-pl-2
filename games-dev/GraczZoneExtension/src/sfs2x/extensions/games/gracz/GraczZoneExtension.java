package sfs2x.extensions.games.gracz;

import com.smartfoxserver.v2.core.SFSEventType;
import com.smartfoxserver.v2.extensions.SFSExtension;


public class GraczZoneExtension extends SFSExtension {
	@Override
	public void init()
	{
	    trace("Hello, this is Gracz.pl ZoneExtension for login, createRoom and get users list functions!");

	    addRequestHandler("createRoom", CreateRoomHandler.class); // added by £ukasz Wyporek 17.06.2014
	    addRequestHandler("getAllUsers", GetUsersHandler.class); // added by £ukasz Wyporek 23.07.2014a
	    addRequestHandler("getOptions", GetOptionsHandler.class); // added by £ukasz Wyporek 16.03.2014
	    addRequestHandler("getFriendsList", GetFriendsListHandler.class); // added by £ukasz Wyporek 6.01.2016
	    addRequestHandler("sendInvitation", SendInvitationHandler.class); // added by £ukasz Wyporek 21.02.2016
		
	    // Add a new SFSEvent Handler
	    addEventHandler(SFSEventType.USER_LOGIN, OnLoginEventHandler.class);
	}
	
}
