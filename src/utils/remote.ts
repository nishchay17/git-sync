export function httpsRemoteWithAuth(ownerSlashRepo: string, token: string): string {
  const [owner, repo] = ownerSlashRepo.split("/");
  if (!owner || !repo) throw new Error(`Invalid targetRepo: ${ownerSlashRepo}`);
  const enc = encodeURIComponent(token);
  return `https://x-access-token:${enc}@github.com/${owner}/${repo}.git`;
}

export function httpsRemotePublic(ownerSlashRepo: string): string {
  const [owner, repo] = ownerSlashRepo.split("/");
  if (!owner || !repo) throw new Error(`Invalid targetRepo: ${ownerSlashRepo}`);
  return `https://github.com/${owner}/${repo}.git`;
}
