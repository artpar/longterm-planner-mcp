import { existsSync, copyFileSync, unlinkSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
}

export interface BackupInfo {
  path: string;
  description: string;
  size: number;
  createdAt: Date;
}

/**
 * Manages database backups for disaster recovery
 */
export class BackupManager {
  constructor(
    private dbPath: string,
    private backupDir: string
  ) {
    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the database
   */
  createBackup(description?: string): BackupResult {
    try {
      if (!existsSync(this.dbPath)) {
        return { success: false, error: 'Database file not found' };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const descPart = description ? `-${description}` : '';
      const backupName = `backup-${timestamp}${descPart}.db`;
      const backupPath = join(this.backupDir, backupName);

      // Copy the database file
      copyFileSync(this.dbPath, backupPath);

      // Also copy WAL and SHM files if they exist
      const walPath = `${this.dbPath}-wal`;
      const shmPath = `${this.dbPath}-shm`;

      if (existsSync(walPath)) {
        copyFileSync(walPath, `${backupPath}-wal`);
      }
      if (existsSync(shmPath)) {
        copyFileSync(shmPath, `${backupPath}-shm`);
      }

      return { success: true, backupPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * List all available backups
   */
  listBackups(): BackupInfo[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    const files = readdirSync(this.backupDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.db') || file.endsWith('-wal.db') || file.endsWith('-shm.db')) {
        continue;
      }

      const filePath = join(this.backupDir, file);
      const stats = statSync(filePath);

      // Parse description from filename
      // Format: backup-{timestamp}[-{description}].db
      const match = file.match(/^backup-([^-]+-[^-]+-[^-]+T[^-]+-[^-]+-[^-]+(?:-\d+)?Z?)(?:-(.+))?\.db$/);
      const description = match?.[2] || '';

      backups.push({
        path: filePath,
        description,
        size: stats.size,
        createdAt: stats.mtime
      });
    }

    // Sort by date, newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  }

  /**
   * Restore database from a backup
   */
  restoreBackup(backupPath: string): RestoreResult {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found' };
      }

      // Copy backup to database path
      copyFileSync(backupPath, this.dbPath);

      // Also copy WAL and SHM files if they exist in backup
      const walPath = `${backupPath}-wal`;
      const shmPath = `${backupPath}-shm`;

      if (existsSync(walPath)) {
        copyFileSync(walPath, `${this.dbPath}-wal`);
      } else {
        // Remove existing WAL if no backup WAL
        const dbWal = `${this.dbPath}-wal`;
        if (existsSync(dbWal)) {
          unlinkSync(dbWal);
        }
      }

      if (existsSync(shmPath)) {
        copyFileSync(shmPath, `${this.dbPath}-shm`);
      } else {
        // Remove existing SHM if no backup SHM
        const dbShm = `${this.dbPath}-shm`;
        if (existsSync(dbShm)) {
          unlinkSync(dbShm);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Delete a backup file
   */
  deleteBackup(backupPath: string): RestoreResult {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found' };
      }

      unlinkSync(backupPath);

      // Also delete associated WAL and SHM files
      const walPath = `${backupPath}-wal`;
      const shmPath = `${backupPath}-shm`;

      if (existsSync(walPath)) {
        unlinkSync(walPath);
      }
      if (existsSync(shmPath)) {
        unlinkSync(shmPath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create an automatic backup with rotation
   * Keeps only the specified number of most recent backups
   */
  autoBackup(maxBackups: number = 10): BackupResult {
    // Create new backup
    const result = this.createBackup('auto');
    if (!result.success) {
      return result;
    }

    // Get all backups and delete oldest ones if over limit
    const backups = this.listBackups();

    if (backups.length > maxBackups) {
      // Delete oldest backups (already sorted newest first)
      const toDelete = backups.slice(maxBackups);
      for (const backup of toDelete) {
        this.deleteBackup(backup.path);
      }
    }

    return result;
  }

  /**
   * Get information about a specific backup
   */
  getBackupInfo(backupPath: string): BackupInfo | null {
    if (!existsSync(backupPath)) {
      return null;
    }

    try {
      const stats = statSync(backupPath);
      const filename = basename(backupPath);

      // Parse description from filename
      const match = filename.match(/^backup-([^-]+-[^-]+-[^-]+T[^-]+-[^-]+-[^-]+(?:-\d+)?Z?)(?:-(.+))?\.db$/);
      const description = match?.[2] || '';

      return {
        path: backupPath,
        description,
        size: stats.size,
        createdAt: stats.mtime
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if database has pending changes since last backup
   */
  hasChanges(): boolean {
    const backups = this.listBackups();
    if (backups.length === 0) {
      return true; // No backups = changes
    }

    const latestBackup = backups[0];
    const dbStats = existsSync(this.dbPath) ? statSync(this.dbPath) : null;

    if (!dbStats) {
      return false;
    }

    return dbStats.mtime > latestBackup.createdAt;
  }
}
