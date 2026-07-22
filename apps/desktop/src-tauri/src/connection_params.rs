use crate::models::{ConnectionParams, DatabaseSelection};

pub fn apply_database_override(
    mut params: ConnectionParams,
    database: Option<&str>,
) -> ConnectionParams {
    if let Some(database) = database {
        params.database = DatabaseSelection::Single(database.to_string());
    }
    params
}

#[cfg(test)]
mod tests;
