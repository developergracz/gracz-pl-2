package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.User;

// Added by £ukasz Wyporek, 19.03.2015
public interface IGeneralRoomOptions {	
	public boolean isGameStarted();
	
	public boolean isUserRoomCreator(User user);

	public boolean setNoRankingOption(User user, boolean noRanking);
	public boolean getNoRankingOption();
	
	public boolean setGameDuration(User user, int gameDuration);
	public int getGameDuration();
	
	public boolean setRoomVisibility(User user, String roomVisibility);
	public String getRoomVisibility();

}
