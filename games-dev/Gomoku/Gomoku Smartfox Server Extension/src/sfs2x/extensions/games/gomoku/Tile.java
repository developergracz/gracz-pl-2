package sfs2x.extensions.games.gomoku;

public enum Tile
{
	EMPTY(0),
	BLACK(1),
	WHITE(2);
	
	private Tile(int id)
    {
		this.id = id;
    }
	
	private int id;
	
	public int getId()
    {
	    return id;
    }
	
}
