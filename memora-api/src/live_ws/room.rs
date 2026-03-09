use dashmap::DashMap;
use rand::Rng;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Capacity of each room's broadcast channel (messages).
const CHANNEL_CAPACITY: usize = 256;

/// A single room entry: the broadcast sender and the 6-digit join code.
#[derive(Clone)]
struct RoomEntry {
    sender: broadcast::Sender<String>,
    join_code: String,
}

/// Thread-safe, clone-able room registry backed by DashMap.
#[derive(Clone)]
pub struct RoomRegistry {
    /// room_id → RoomEntry
    rooms: Arc<DashMap<Uuid, RoomEntry>>,
    /// join_code → room_id  (reverse index)
    codes: Arc<DashMap<String, Uuid>>,
}

impl RoomRegistry {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            codes: Arc::new(DashMap::new()),
        }
    }

    /// Create a new room, returning (room_id, join_code, sender).
    pub fn create_room(&self) -> (Uuid, String, broadcast::Sender<String>) {
        let room_id = Uuid::new_v4();
        let join_code = self.generate_unique_code();
        let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);

        self.rooms.insert(
            room_id,
            RoomEntry {
                sender: sender.clone(),
                join_code: join_code.clone(),
            },
        );
        self.codes.insert(join_code.clone(), room_id);

        (room_id, join_code, sender)
    }

    /// Get the broadcast sender for an existing room.
    pub fn get_sender(&self, room_id: &Uuid) -> Option<broadcast::Sender<String>> {
        self.rooms.get(room_id).map(|e| e.sender.clone())
    }

    /// Resolve a join code to a room_id.
    pub fn resolve_join_code(&self, code: &str) -> Option<Uuid> {
        self.codes.get(code).map(|id| *id)
    }

    /// Remove a room when all clients have disconnected.
    pub fn remove_room(&self, room_id: &Uuid) {
        if let Some((_, entry)) = self.rooms.remove(room_id) {
            self.codes.remove(&entry.join_code);
        }
    }

    fn generate_unique_code(&self) -> String {
        let mut rng = rand::rng();
        loop {
            let code = format!("{:06}", rng.random_range(0..=999_999u32));
            if !self.codes.contains_key(&code) {
                return code;
            }
        }
    }
}

impl Default for RoomRegistry {
    fn default() -> Self {
        Self::new()
    }
}
