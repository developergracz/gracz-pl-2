package sfs2x.extensions.games.checkers;

public enum Tile
{
	EMPTY(0),
	ENABLE(1),
	WHITE(2),
	BLACK(4),
	WHITE_QUEEN(6),
	BLACK_QUEEN(8);
	
	private Tile(int id)
    {
		this.id = id;
    }
	
	private int id;
	
	public int getId()
    {
	    return id;
    }
	
	public static Tile getTileById(int id) {
		switch(id) {
			case 0:
				return Tile.EMPTY;
			case 1:
				return Tile.ENABLE;	
			case 4:
				return Tile.BLACK;
			case 2:
				return Tile.WHITE;
			case 8:
				return Tile.BLACK_QUEEN;
			case 6:
				return Tile.WHITE_QUEEN;
		}
		return null;
	}
}
