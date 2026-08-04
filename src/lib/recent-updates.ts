type RecentlyUpdatedPost = { data: { publishedAt: Date; updatedAt?: Date } };

export function sortPostsRecentlyUpdated<T extends RecentlyUpdatedPost>(posts: readonly T[]): T[] {
  return [...posts].sort((left, right) => {
    const leftUpdatedAt = left.data.updatedAt ?? left.data.publishedAt;
    const rightUpdatedAt = right.data.updatedAt ?? right.data.publishedAt;
    const updatedDifference = rightUpdatedAt.getTime() - leftUpdatedAt.getTime();
    return updatedDifference || right.data.publishedAt.getTime() - left.data.publishedAt.getTime();
  });
}
