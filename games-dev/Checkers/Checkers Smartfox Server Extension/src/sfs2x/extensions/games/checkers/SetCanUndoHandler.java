package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class SetCanUndoHandler extends BaseClientRequestHandler {
	
	@Override
	public void handleClientRequest(User user, ISFSObject params) {

		CheckersExtension gameExt = (CheckersExtension) getParentExtension();
		Boolean canUndo = params.getBool("canUndo");
		// TODO
		
		//Email myEmail = new SFSEmail(this.fromEmail, to, subject, mail);
		gameExt.trace("Setting CanUndo option to: "+canUndo);
	}

}
