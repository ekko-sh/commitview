import simpleGit from 'simple-git';

export interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  subject: string;
  author: string;
  authorEmail: string;
  date: Date;
  relativeDate: string;
}

export class CommitService {
  async getRecentCommits(repoPath: string, limit: number = 100): Promise<Commit[]> {
    const git = simpleGit(repoPath);

    const log = await git.log({
      maxCount: limit,
      format: {
        hash: '%H',
        message: '%B',
        author_name: '%an',
        author_email: '%ae',
        date: '%aI',
      },
    });

    return log.all.map((entry) => ({
      sha: entry.hash,
      shortSha: entry.hash.substring(0, 7),
      message: entry.message.trim(),
      subject: entry.message.split('\n')[0].trim(),
      author: entry.author_name,
      authorEmail: entry.author_email,
      date: new Date(entry.date),
      relativeDate: this.getRelativeDate(new Date(entry.date)),
    }));
  }

  async searchCommits(repoPath: string, query: string, limit: number = 50): Promise<Commit[]> {
    const git = simpleGit(repoPath);

    const log = await git.log({
      maxCount: limit,
      '--grep': query,
      format: {
        hash: '%H',
        message: '%B',
        author_name: '%an',
        author_email: '%ae',
        date: '%aI',
      },
    });

    return log.all.map((entry) => ({
      sha: entry.hash,
      shortSha: entry.hash.substring(0, 7),
      message: entry.message.trim(),
      subject: entry.message.split('\n')[0].trim(),
      author: entry.author_name,
      authorEmail: entry.author_email,
      date: new Date(entry.date),
      relativeDate: this.getRelativeDate(new Date(entry.date)),
    }));
  }

  async getCommit(repoPath: string, sha: string): Promise<Commit | null> {
    const git = simpleGit(repoPath);

    try {
      const log = await git.log({
        maxCount: 1,
        from: sha,
        to: sha,
        format: {
          hash: '%H',
          message: '%B',
          author_name: '%an',
          author_email: '%ae',
          date: '%aI',
        },
      });

      if (log.all.length === 0) {
        return null;
      }

      const entry = log.all[0];
      return {
        sha: entry.hash,
        shortSha: entry.hash.substring(0, 7),
        message: entry.message.trim(),
        subject: entry.message.split('\n')[0].trim(),
        author: entry.author_name,
        authorEmail: entry.author_email,
        date: new Date(entry.date),
        relativeDate: this.getRelativeDate(new Date(entry.date)),
      };
    } catch {
      return null;
    }
  }

  private getRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    } else {
      return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
    }
  }
}
