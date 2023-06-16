export interface Room {
  id: string;
  slug: string;
  createdBy: string;
  likedPlaces: { [key: string]: string[] };
}
