/**
 * Who may open a player's profile: anyone while it's public, and the owner
 * always (so turning it private never locks you out of your own page).
 */
export function canViewProfile(
  target: { id: string; profilePublic: boolean },
  viewerId: string | null | undefined,
): boolean {
  return target.profilePublic || viewerId === target.id;
}
