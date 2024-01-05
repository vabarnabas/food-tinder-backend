export interface Room {
  id: string;
  slug: string;
  leader: string;
  likedPlaces: { [key: string]: string[] };
}
