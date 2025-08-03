// Migrado a DatabaseService
// export { threadPersistence } from './threadPersistence.js';

// Backward compatibility - re-export new service
import { ThreadPersistenceService } from '../../core/services/thread-persistence.service';
import { DatabaseService } from '../../core/services/database.service';

// Create a compatibility instance
const databaseService = new DatabaseService();
export const threadPersistence = new ThreadPersistenceService(databaseService); 